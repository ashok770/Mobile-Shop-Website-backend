import mongoose from "mongoose";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Settings from "../models/Settings.js";
const VALID_STATUSES = [
  "Pending",
  "Confirmed",
  "Packed",
  "Shipped",
  "Out for Delivery",
  "Delivered",
  "Cancelled",
];

const VALID_PAYMENT_STATUSES = ["Pending", "Paid", "Failed", "Refunded"];

// V1 State Transition Matrix (Terminal states: Delivered & Cancelled)
const ALLOWED_TRANSITIONS = {
  Pending: ["Confirmed", "Cancelled"],
  Confirmed: ["Packed", "Cancelled"],
  Packed: ["Shipped", "Cancelled"],
  Shipped: ["Out for Delivery", "Cancelled"],
  "Out for Delivery": ["Delivered", "Cancelled"],
  Delivered: [], // Terminal state in V1
  Cancelled: [], // Terminal state in V1
};

/**
 * Format order response with fallback calculation for 9 legacy orders
 * that have subtotal, shippingCharge, or totalAmount as undefined.
 */
export const formatOrderForResponse = (orderDoc) => {
  if (!orderDoc) return orderDoc;
  const obj = typeof orderDoc.toObject === "function" ? orderDoc.toObject() : { ...orderDoc };

  let subtotal = obj.subtotal;
  if (subtotal === undefined || subtotal === null) {
    subtotal = (obj.items || []).reduce(
      (acc, item) => acc + (Number(item.price) || 0) * (Number(item.quantity) || 1),
      0
    );
    obj.subtotal = Math.max(0, Math.round(subtotal * 100) / 100);
  }

  if (obj.shippingCharge === undefined || obj.shippingCharge === null) {
    obj.shippingCharge = obj.subtotal > 0 && obj.subtotal < 500 ? 49 : 0;
  }

  if (obj.totalAmount === undefined || obj.totalAmount === null) {
    obj.totalAmount = Math.max(0, Math.round((obj.subtotal + obj.shippingCharge) * 100) / 100);
  }

  return obj;
};

// CREATE order (Protected - logged-in users only)
export const createOrder = async (req, res) => {
  try {
    const { items, customerName, phone, address, paymentMethod } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No items in order" });
    }

    if (!customerName || !phone || !address) {
      return res.status(400).json({
        success: false,
        message: "Customer name, phone and address are required",
      });
    }

    // Validate ObjectIds
    for (const item of items) {
      if (!mongoose.Types.ObjectId.isValid(item.productId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid product ID in order items",
        });
      }
    }

    // Fetch products once (avoid N+1 queries)
    const productIds = items.map((item) => item.productId);
    const products = await Product.find({ _id: { $in: productIds } }).lean();

    if (products.length !== productIds.length) {
      return res.status(404).json({
        success: false,
        message: "One or more products not found",
      });
    }

    const productMap = new Map(products.map((p) => [p._id.toString(), p]));

    // Build order items with server-side prices (never trust client prices)
    const orderItems = [];
    let subtotal = 0;

    for (const item of items) {
      const product = productMap.get(item.productId.toString());

      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product not found: ${item.productId}`,
        });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Only ${product.stock} left for ${product.name}`,
        });
      }

      const price = product.finalPrice;
      subtotal += price * item.quantity;

      orderItems.push({
        productId: product._id,
        name: product.name,
        image: product.image || "",
        price,
        quantity: item.quantity,
      });
    }

    // Compute totals server-side
    const { freeShippingThreshold = 500, baseShippingCharge = 49 } = (await Settings.findOne({ key: "default" })) || {};
const shippingCharge = subtotal > 0 && subtotal < freeShippingThreshold ? baseShippingCharge : 0;
    const totalAmount = Math.max(0, Math.round((subtotal + shippingCharge) * 100) / 100);

    // Reduce stock atomically with bulkWrite (single round-trip)
    const bulkOps = orderItems.map((item) => ({
      updateOne: {
        filter: { _id: item.productId, stock: { $gte: item.quantity } },
        update: { $inc: { stock: -item.quantity } },
      },
    }));

    const bulkResult = await Product.bulkWrite(bulkOps);

    // Verify all stock updates succeeded
    if (bulkResult.modifiedCount !== orderItems.length) {
      return res.status(400).json({
        success: false,
        message: "Stock validation failed during update",
      });
    }

    // Save order
    const order = await Order.create({
      user: req.user._id,
      customerName,
      phone,
      address,
      items: orderItems,
      subtotal: Math.max(0, Math.round(subtotal * 100) / 100),
      shippingCharge,
      totalAmount,
      paymentMethod: paymentMethod === "ONLINE" ? "ONLINE" : "COD",
      paymentStatus: "Pending",
      orderStatus: "Pending",
    });

    res.status(201).json({
      success: true,
      order: formatOrderForResponse(order),
    });
  } catch (error) {
    console.error("Create order error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET all orders (Admin only) - with hardened search, status/payment filters, date queries, & pagination
export const getOrders = async (req, res) => {
  try {
    const {
      page,
      limit,
      search,
      status,
      paymentStatus,
      startDate,
      endDate,
    } = req.query;

    const filter = {};

    // 1. Search Query Hardening (customerName, phone, or Order ID)
    const searchVal = Array.isArray(search) ? search[0] : search;
    if (typeof searchVal === "string" && searchVal.trim().length > 0) {
      const trimmed = searchVal.trim().slice(0, 100);
      const sanitized = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      const searchOr = [
        { customerName: { $regex: sanitized, $options: "i" } },
        { phone: { $regex: sanitized, $options: "i" } },
      ];

      // If valid ObjectId, add exact _id match
      if (mongoose.Types.ObjectId.isValid(trimmed)) {
        searchOr.push({ _id: new mongoose.Types.ObjectId(trimmed) });
      }

      filter.$or = searchOr;
    }

    // 2. Status Filter Validation
    const statusVal = Array.isArray(status) ? status[0] : status;
    if (statusVal && statusVal !== "ALL" && VALID_STATUSES.includes(statusVal)) {
      filter.orderStatus = statusVal;
    }

    // 3. Payment Status Filter Validation
    const payStatusVal = Array.isArray(paymentStatus) ? paymentStatus[0] : paymentStatus;
    if (payStatusVal && payStatusVal !== "ALL" && VALID_PAYMENT_STATUSES.includes(payStatusVal)) {
      filter.paymentStatus = payStatusVal;
    }

    // 4. Date Range Filter
    const startVal = Array.isArray(startDate) ? startDate[0] : startDate;
    const endVal = Array.isArray(endDate) ? endDate[0] : endDate;
    if (startVal || endVal) {
      filter.createdAt = {};
      if (startVal && !isNaN(Date.parse(startVal))) {
        filter.createdAt.$gte = new Date(startVal);
      }
      if (endVal && !isNaN(Date.parse(endVal))) {
        const endD = new Date(endVal);
        endD.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = endD;
      }
    }

    // 5. Pagination Parsing & Clamping
    const rawPage = parseInt(Array.isArray(page) ? page[0] : page, 10);
    const pageNum = isNaN(rawPage) || rawPage <= 0 ? 1 : rawPage;

    const rawLimit = parseInt(Array.isArray(limit) ? limit[0] : limit, 10);
    const limitNum = isNaN(rawLimit) || rawLimit <= 0 ? 20 : Math.min(100, rawLimit);

    const total = await Order.countDocuments(filter);
    const totalPages = Math.ceil(total / limitNum) || 1;

    // High page offset optimization
    if (pageNum > totalPages) {
      return res.json({
        success: true,
        count: 0,
        total,
        page: pageNum,
        totalPages,
        orders: [],
      });
    }

    const skip = (pageNum - 1) * limitNum;
    const rawOrdersList = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const formattedOrders = rawOrdersList.map(formatOrderForResponse);

    res.json({
      success: true,
      count: formattedOrders.length,
      total,
      page: pageNum,
      totalPages,
      orders: formattedOrders,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET logged-in user's orders
export const getMyOrders = async (req, res) => {
  try {
    const rawOrders = await Order.find({
      user: req.user._id,
    }).sort({
      createdAt: -1,
    });

    const orders = rawOrders.map(formatOrderForResponse);

    res.json({
      success: true,
      count: orders.length,
      orders,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// GET single order (Hardened ObjectId validation & Admin override support)
export const getOrderById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID format",
      });
    }

    const query = { _id: req.params.id };

    // If caller is NOT admin, constrain to logged-in user's own order
    const isAdmin = Boolean(req.admin);
    if (!isAdmin) {
      if (!req.user) {
        return res.status(401).json({ success: false, message: "Not authorized" });
      }
      query.user = req.user._id;
    }

    const orderDoc = await Order.findOne(query);

    if (!orderDoc) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    res.json({
      success: true,
      order: formatOrderForResponse(orderDoc),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// UPDATE order status (Admin only) - Hardened Transition Matrix & Stock Restoration on Cancellation
export const updateOrderStatus = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID format",
      });
    }

    const { orderStatus } = req.body;

    if (!orderStatus) {
      return res
        .status(400)
        .json({ success: false, message: "orderStatus is required" });
    }

    if (!VALID_STATUSES.includes(orderStatus)) {
      return res.status(400).json({
        success: false,
        message: `orderStatus must be one of: ${VALID_STATUSES.join(", ")}`,
      });
    }

    // Step 1: Fetch target order document
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    const currentStatus = order.orderStatus;

    // Idempotent check: if status is unchanged, return current order cleanly
    if (currentStatus === orderStatus) {
      return res.json({ success: true, order: formatOrderForResponse(order) });
    }

    // Step 2: Validate transition matrix
    const allowedNext = ALLOWED_TRANSITIONS[currentStatus] || [];
    if (!allowedNext.includes(orderStatus)) {
      return res.status(409).json({
        success: false,
        message: `Cannot transition order status from '${currentStatus}' to '${orderStatus}'.`,
      });
    }

    const updateFields = { orderStatus };

    // Step 3: Auto-updates for Delivered status
    if (orderStatus === "Delivered") {
      updateFields.deliveredAt = new Date();
      if (order.paymentMethod === "COD") {
        updateFields.paymentStatus = "Paid";
        updateFields.paidAt = new Date();
      }
    }

    // Step 4: Stock Restoration on Cancellation
    if (orderStatus === "Cancelled" && currentStatus !== "Cancelled") {
      const items = order.items || [];
      const validStockItems = [];
      const skippedItems = [];

      for (const item of items) {
        if (item.productId && mongoose.Types.ObjectId.isValid(item.productId)) {
          validStockItems.push(item);
        } else {
          skippedItems.push(item);
        }
      }

      let restoredCount = 0;
      let failedCount = 0;

      if (validStockItems.length > 0) {
        const restoreOps = validStockItems.map((item) => ({
          updateOne: {
            filter: { _id: item.productId },
            update: { $inc: { stock: Math.max(1, Number(item.quantity) || 1) } },
          },
        }));

        try {
          const bulkResult = await Product.bulkWrite(restoreOps);
          restoredCount = bulkResult.modifiedCount || 0;
          failedCount = validStockItems.length - restoredCount;

          console.log(`[Order Cancellation Stock Restoration]`, {
            orderId: order._id.toString(),
            totalItems: items.length,
            validItemsAttempted: validStockItems.length,
            skippedItemsCount: skippedItems.length,
            restoredCount,
            failedCount,
          });
        } catch (err) {
          console.error(`[Order Cancellation Stock Restoration Failed] Order ${order._id}:`, err.message);
        }
      } else if (skippedItems.length > 0) {
        console.log(`[Order Cancellation Stock Restoration]`, {
          orderId: order._id.toString(),
          totalItems: items.length,
          validItemsAttempted: 0,
          skippedItemsCount: skippedItems.length,
          restoredCount: 0,
          failedCount: 0,
        });
      }
    }

    // Step 5: Update order document
    const updated = await Order.findByIdAndUpdate(
      req.params.id,
      { $set: updateFields },
      { new: true }
    );

    res.json({ success: true, order: formatOrderForResponse(updated) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET order stats (Admin only) - aggregation for performance with legacy total fallbacks
export const getOrderStats = async (req, res) => {
  try {
    const rawOrders = await Order.find({}).lean();
    const formattedOrders = rawOrders.map(formatOrderForResponse);

    const totalOrders = formattedOrders.length;
    let pendingOrders = 0;
    let deliveredOrders = 0;
    let totalRevenue = 0;

    formattedOrders.forEach((o) => {
      if (o.orderStatus === "Pending") {
        pendingOrders++;
      } else if (o.orderStatus === "Delivered") {
        deliveredOrders++;
        totalRevenue += o.totalAmount || 0;
      }
    });

    res.json({
      success: true,
      totalOrders,
      pendingOrders,
      deliveredOrders,
      totalRevenue: Math.max(0, Math.round(totalRevenue * 100) / 100),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
