import Order from "../models/Order.js";
import Product from "../models/Product.js";

export const getDashboard = async (req, res) => {
  try {
    // Logged-in user
    const user = req.user;

    // Total Orders
    const totalOrders = await Order.countDocuments({
      user: user._id,
    });

    // Recent Orders
    const recentOrders = await Order.find({
      user: user._id,
    })
      .sort({ createdAt: -1 })
      .limit(5);

    // Recommended Products
    const recommendedProducts = await Product.find()
      .sort({ createdAt: -1 })
      .limit(4);

    res.json({
      success: true,

      user,

      stats: {
        totalOrders,
        wishlist: 0,
        addresses: 0,
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
