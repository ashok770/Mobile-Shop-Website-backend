import express from "express";
import {
  createOrder,
  getOrders,
  getMyOrders,
  getOrderById,
  updateOrderStatus,
  getOrderStats,
} from "../controllers/orderController.js";
import protect, { adminOnly, adminProtect } from "../middleware/authMiddleware.js";

const router = express.Router();

// ===== Customer endpoints (protect only) =====

// POST create order (logged-in users only)
router.post("/", protect, createOrder);

// GET logged-in user's orders
router.get("/my-orders", protect, getMyOrders);

// GET single order (logged-in user's own order)
router.get("/:id", protect, getOrderById);

// ===== Admin endpoints (adminProtect + adminOnly) =====

// GET all orders (Admin only)
router.get("/", adminProtect, adminOnly, getOrders);

// GET admin stats (Admin only)
router.get("/stats/admin", adminProtect, adminOnly, getOrderStats);

// PUT update order status (Admin only)
router.put("/:id/status", adminProtect, adminOnly, updateOrderStatus);

export default router;
