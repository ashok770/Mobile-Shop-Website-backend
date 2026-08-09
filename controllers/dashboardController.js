import Order from "../models/Order.js";
import Product from "../models/Product.js";

export const getDashboard = async (req, res) => {
  try {
    // Logged-in user (full document attached by auth middleware)
    const user = req.user;

    // Run independent queries in parallel
    const [orderStats, recentOrders, recommendedProducts] = await Promise.all([
      // Aggregate all order stats in a single query
      Order.aggregate([
        { $match: { user: user._id } },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            pendingOrders: {
              $sum: { $cond: [{ $eq: ["$orderStatus", "Pending"] }, 1, 0] },
            },
            deliveredOrders: {
              $sum: { $cond: [{ $eq: ["$orderStatus", "Delivered"] }, 1, 0] },
            },
            totalSpent: {
              $sum: {
                $cond: [
                  { $eq: ["$orderStatus", "Delivered"] },
                  "$totalAmount",
                  0,
                ],
              },
            },
          },
        },
      ]),

      // Recent Orders - latest 5 sorted by newest first
      Order.find({ user: user._id }).sort({ createdAt: -1 }).limit(5),

      // Recommended Products - latest 4, only in stock
      Product.find({ stock: { $gt: 0 } })
        .sort({ createdAt: -1 })
        .limit(4),
    ]);

    // Extract stats (default to 0 if user has no orders)
    const statsData = orderStats[0] || {};

    res.json({
      success: true,

      user,

      stats: {
        totalOrders: statsData.totalOrders || 0,
        pendingOrders: statsData.pendingOrders || 0,
        deliveredOrders: statsData.deliveredOrders || 0,
        totalSpent: statsData.totalSpent || 0,
        wishlist: user.wishlist.length,
        addresses: user.addresses.length,
        rewardPoints: 0,
      },

      recentOrders,

      recommendedProducts,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};
