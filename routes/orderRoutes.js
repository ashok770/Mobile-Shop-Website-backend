import express from "express";
import {
  createOrder,
  getOrders,
  updateOrderStatus,
} from "../controllers/orderController.js";
import protect from "../middleware/authMiddleware.js";
import Order from "../models/Order.js";

const router = express.Router();

// Public
router.post("/", createOrder);

// Admin only
router.get("/", protect, getOrders);
router.put("/:id", protect, updateOrderStatus);

// GET admin stats
router.get("/stats/admin", protect, async (req, res) => {
  const orders = await Order.find();

  const totalOrders = orders.length;
  const pendingOrders = orders.filter(
    (o) => o.orderStatus === "Pending"
  ).length;

  const deliveredOrders = orders.filter(
    (o) => o.orderStatus === "Delivered"
  );

  const totalRevenue = deliveredOrders.reduce((sum, order) => {
    return (
      sum +
      order.items.reduce(
        (itemSum, item) =>
          itemSum + item.price * item.quantity,
        0
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
