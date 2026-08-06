import express from "express";
import {
  createOrder,
  getOrders,
  getMyOrders,
  getOrderById,
  updateOrderStatus,
} from "../controllers/orderController.js";
import protect from "../middleware/authMiddleware.js";
import Order from "../models/Order.js";

const router = express.Router();

// Protected - logged-in users only
router.post("/", protect, createOrder);

// GET logged-in user's orders
router.get("/my-orders", protect, getMyOrders);

// GET single order (logged-in user's own order)
router.get("/:id", protect, getOrderById);

// Admin only
router.get("/", protect, getOrders);
router.put("/:id", protect, updateOrderStatus);

// Update order status (Admin)
router.put("/:id/status", protect, async (req, res) => {
  const { orderStatus } = req.body;

  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    order.orderStatus = orderStatus;
    await order.save();

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET admin stats
router.get("/stats/admin", protect, async (req, res) => {
  const orders = await Order.find();

  const totalOrders = orders.length;
  const pendingOrders = orders.filter(
    (o) => o.orderStatus === "Pending",
  ).length;

  const deliveredOrders = orders.filter((o) => o.orderStatus === "Delivered");

  const totalRevenue = deliveredOrders.reduce((sum, order) => {
    return (
      sum +
      order.items.reduce(
        (itemSum, item) => itemSum + item.price * item.quantity,
        0,
      )
    );
  }, 0);

  res.json({
    totalOrders,
    pendingOrders,
    deliveredOrders: deliveredOrders.length,
    totalRevenue,
  });
});

export default router;
