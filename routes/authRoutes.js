import express from "express";
import rateLimit from "express-rate-limit";
import protect from "../middleware/authMiddleware.js";
import {
  register,
  login,
  getCurrentUser,
} from "../controllers/authController.js";

const router = express.Router();

// Stricter rate limit for auth endpoints (brute-force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 attempts per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login/register attempts, please try again later.",
  },
});

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.get("/me", protect, getCurrentUser);

export default router;
