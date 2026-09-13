import express from "express";
import rateLimit from "express-rate-limit";
import {
  adminLogin,
  adminLogout,
  adminForgotPassword,
  adminResetPassword,
} from "../controllers/adminController.js";
import { adminProtect } from "../middleware/authMiddleware.js";

const router = express.Router();

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login attempts. Please try again later.",
  },
});

const adminForgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // 3 attempts per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many password reset requests. Please try again later.",
  },
});

const adminResetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many reset attempts. Please try again later.",
  },
});

router.post("/login", adminLoginLimiter, adminLogin);
router.post("/logout", adminProtect, adminLogout);
router.post(
  "/forgot-password",
  adminForgotPasswordLimiter,
  adminForgotPassword,
);
router.post(
  "/reset-password",
  adminResetPasswordLimiter,
  adminResetPassword,
);

export default router;
