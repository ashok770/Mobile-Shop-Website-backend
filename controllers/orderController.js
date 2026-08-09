import mongoose from "mongoose";
import Order from "../models/Order.js";
import Product from "../models/Product.js";

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
    const shippingCharge = subtotal > 0 && subtotal < 500 ? 49 : 0;
    const totalAmount = subtotal + shippingCharge;

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
      subtotal,
      shippingCharge,
      totalAmount,
      paymentMethod: paymentMethod === "ONLINE" ? "ONLINE" : "COD",
      paymentStatus: "Pending",
      orderStatus: "Pending",
    });

    res.status(201).json({
      success: true,
      order,
    });
  } catch (error) {
    console.error("Create order error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET all orders (Admin only) - with pagination
export const getOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      Order.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
      Order.countDocuments(),
    ]);

    res.json({
      success: true,
      count: orders.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      orders,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET logged-in user's orders
export const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      user: req.user._id,
    }).sort({
      createdAt: -1,
    });

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

// GET single order
export const getOrderById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    const order = await Order.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    res.json({
      success: true,
      order,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// UPDATE order status (Admin only)
export const updateOrderStatus = async (req, res) => {
  try {
    const { orderStatus } = req.body;

    if (!orderStatus) {
      return res
        .status(400)
        .json({ success: false, message: "orderStatus is required" });
    }

    const validStatuses = [
      "Pending",
      "Confirmed",
      "Packed",
      "Shipped",
      "Out for Delivery",
      "Delivered",
      "Cancelled",
    ];

    if (!validStatuses.includes(orderStatus)) {
      return res.status(400).json({
        success: false,
        message: `orderStatus must be one of: ${validStatuses.join(", ")}`,
      });
    }

    const updateFields = { orderStatus };

    // Auto-set deliveredAt when order is delivered
    if (orderStatus === "Delivered") {
      updateFields.deliveredAt = new Date();
    }

    // Auto-set paidAt when order was COD and is delivered
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    if (orderStatus === "Delivered" && order.paymentMethod === "COD") {
      updateFields.paymentStatus = "Paid";
      updateFields.paidAt = new Date();
    }

    const updated = await Order.findByIdAndUpdate(
      req.params.id,
      { $set: updateFields },
      { new: true },
    );

    res.json({ success: true, order: updated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// GET order stats (Admin only) - aggregation for performance
export const getOrderStats = async (req, res) => {
  try {
    const [stats] = await Order.aggregate([
      {
        $facet: {
          totals: [{ $group: { _id: null, totalOrders: { $sum: 1 } } }],
          pending: [
            { $match: { orderStatus: "Pending" } },
            { $count: "count" },
          ],
          delivered: [
            { $match: { orderStatus: "Delivered" } },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                revenue: { $sum: "$totalAmount" },
              },
            },
          ],
        },
      },
    ]);

    const totalOrders = stats?.totals?.[0]?.totalOrders || 0;
    const pendingOrders = stats?.pending?.[0]?.count || 0;
    const delivered = stats?.delivered?.[0] || { count: 0, revenue: 0 };

    res.json({
      success: true,
      totalOrders,
      pendingOrders,
      deliveredOrders: delivered.count,
      totalRevenue: delivered.revenue,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
