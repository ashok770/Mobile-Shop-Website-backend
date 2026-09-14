import mongoose from "mongoose";
import User from "../models/User.js";
import Order from "../models/Order.js";

const VALID_STATUSES = ["ACTIVE", "DISABLED", "SUSPENDED"];

/**
 * PII-Safe Customer List Serializer
 * Strips password, googleId, and auth secrets.
 */
const serializeCustomerForList = (user, orderStatsMap = new Map()) => {
  const stats = orderStatsMap.get(user._id.toString()) || { ordersCount: 0 };
  return {
    _id: user._id,
    name: user.name || "N/A",
    email: user.email || "N/A",
    avatar: user.avatar || "",
    role: user.role || "customer",
    accountStatus: user.accountStatus || "ACTIVE",
    emailVerified: Boolean(user.emailVerified),
    addressesCount: (user.addresses || []).length,
    ordersCount: stats.ordersCount || 0,
    createdAt: user.createdAt,
  };
};

// GET /api/admin/customers - List & Search Customers (Admin Only)
export const getAdminCustomers = async (req, res) => {
  try {
    const { page, limit, search, accountStatus } = req.query;

    const filter = {};

    // Search Query Hardening (name, email, phone in address, or User ID)
    const searchVal = Array.isArray(search) ? search[0] : search;
    if (typeof searchVal === "string" && searchVal.trim().length > 0) {
      const trimmed = searchVal.trim().slice(0, 100);
      const sanitized = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      const searchOr = [
        { name: { $regex: sanitized, $options: "i" } },
        { email: { $regex: sanitized, $options: "i" } },
        { "addresses.phone": { $regex: sanitized, $options: "i" } },
      ];

      if (mongoose.Types.ObjectId.isValid(trimmed)) {
        searchOr.push({ _id: new mongoose.Types.ObjectId(trimmed) });
      }

      filter.$or = searchOr;
    }

    // Account Status Filter Validation
    const statusVal = Array.isArray(accountStatus) ? accountStatus[0] : accountStatus;
    if (statusVal && statusVal !== "ALL" && VALID_STATUSES.includes(statusVal)) {
      filter.accountStatus = statusVal;
    }

    // Pagination Parsing & Clamping
    const rawPage = parseInt(Array.isArray(page) ? page[0] : page, 10);
    const pageNum = isNaN(rawPage) || rawPage <= 0 ? 1 : rawPage;

    const rawLimit = parseInt(Array.isArray(limit) ? limit[0] : limit, 10);
    const limitNum = isNaN(rawLimit) || rawLimit <= 0 ? 20 : Math.min(100, rawLimit);

    const total = await User.countDocuments(filter);
    const totalPages = Math.ceil(total / limitNum) || 1;

    // High page offset optimization
    if (pageNum > totalPages) {
      return res.json({
        success: true,
        count: 0,
        total,
        page: pageNum,
        totalPages,
        customers: [],
      });
    }

    const skip = (pageNum - 1) * limitNum;
    const rawUsers = await User.find(filter)
      .select("-password -googleId")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Fetch order counts for list table preview
    const userIds = rawUsers.map((u) => u._id);
    const orderStatsList = await Order.aggregate([
      { $match: { user: { $in: userIds } } },
      { $group: { _id: "$user", ordersCount: { $sum: 1 } } },
    ]);

    const orderStatsMap = new Map(orderStatsList.map((s) => [s._id.toString(), s]));

    const formattedCustomers = rawUsers.map((u) => serializeCustomerForList(u, orderStatsMap));

    res.json({
      success: true,
      count: formattedCustomers.length,
      total,
      page: pageNum,
      totalPages,
      customers: formattedCustomers,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/admin/customers/:id - Single Customer Detail & Order History Summary (Admin Only)
export const getAdminCustomerById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID format",
      });
    }

    const user = await User.findById(id).select("-password -googleId").lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    // Aggregate Order Statistics for this Customer
    const statsResult = await Order.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(id) } },
      {
        $group: {
          _id: "$user",
          totalOrders: { $sum: 1 },
          deliveredOrders: {
            $sum: { $cond: [{ $eq: ["$orderStatus", "Delivered"] }, 1, 0] },
          },
          cancelledOrders: {
            $sum: { $cond: [{ $eq: ["$orderStatus", "Cancelled"] }, 1, 0] },
          },
          totalSpent: {
            $sum: {
              $cond: [{ $ne: ["$orderStatus", "Cancelled"] }, "$totalAmount", 0],
            },
          },
        },
      },
    ]);

    const stats = statsResult[0] || {
      totalOrders: 0,
      deliveredOrders: 0,
      cancelledOrders: 0,
      totalSpent: 0,
    };

    // Fetch top 5 recent orders for this customer
    const recentOrders = await Order.find({ user: id })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("_id createdAt orderStatus paymentStatus totalAmount items")
      .lean();

    const formattedRecentOrders = recentOrders.map((o) => ({
      _id: o._id,
      createdAt: o.createdAt,
      orderStatus: o.orderStatus,
      paymentStatus: o.paymentStatus,
      totalAmount: o.totalAmount ?? 0,
      itemsCount: (o.items || []).length,
    }));

    res.json({
      success: true,
      customer: {
        _id: user._id,
        name: user.name || "N/A",
        email: user.email || "N/A",
        avatar: user.avatar || "",
        role: user.role || "customer",
        accountStatus: user.accountStatus || "ACTIVE",
        emailVerified: Boolean(user.emailVerified),
        addresses: user.addresses || [],
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        stats: {
          totalOrders: stats.totalOrders,
          deliveredOrders: stats.deliveredOrders,
          cancelledOrders: stats.cancelledOrders,
          totalSpent: Math.max(0, Math.round((stats.totalSpent || 0) * 100) / 100),
        },
        recentOrders: formattedRecentOrders,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/admin/customers/:id/status - Update Customer Account Status (Admin Only)
export const updateCustomerStatus = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID format",
      });
    }

    const { accountStatus } = req.body;

    if (!accountStatus) {
      return res.status(400).json({
        success: false,
        message: "accountStatus is required",
      });
    }

    if (!VALID_STATUSES.includes(accountStatus)) {
      return res.status(400).json({
        success: false,
        message: `accountStatus must be one of: ${VALID_STATUSES.join(", ")}`,
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    // Update accountStatus
    user.accountStatus = accountStatus;
    await user.save();

    const updatedUser = await User.findById(id).select("-password -googleId").lean();

    res.json({
      success: true,
      message: `Customer account status updated to ${accountStatus}.`,
      customer: {
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        accountStatus: updatedUser.accountStatus,
        updatedAt: updatedUser.updatedAt,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
