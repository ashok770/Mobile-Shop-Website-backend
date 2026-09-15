import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import connectDB from "./config/db.js";
import cookieParser from "cookie-parser";

// Routes
import adminRoutes from "./routes/adminRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import chatbotRoutes from "./routes/chatRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import homepageRoutes from "./routes/homepageRoutes.js";
import wishlistRoutes from "./routes/wishlistRoutes.js";
import addressRoutes from "./routes/addressRoutes.js";
import adminCustomerRoutes from "./routes/adminCustomerRoutes.js";
import brandRoutes, { adminBrandRoutes } from "./routes/brandRoutes.js";

// Init app
const app = express();

// Render sends requests through one public reverse-proxy hop. Trusting exactly
// that hop lets Express use the client address from X-Forwarded-For safely.
app.set("trust proxy", 1);

// Security middleware
app.use(helmet());

// CORS - restrict to known origins
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
  : ["http://localhost:5173", "http://localhost:3000"];

// In development, allow any localhost origin regardless of port
const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;

  try {
    const url = new URL(origin);
    const isLocalhost =
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "::1";

    const isProduction = process.env.NODE_ENV === "production";

    // Allow any localhost origin during development
    if (!isProduction && isLocalhost) return true;

    return false;
  } catch {
    return false;
  }
};

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);

// Global rate limit
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // 300 requests per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests, please try again later.",
  },
});

app.use(globalLimiter);

app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

// Database
connectDB();

// Routes
app.use("/api/admin/brands", adminBrandRoutes);
app.use("/api/brands", brandRoutes);
app.use("/api/admin/customers", adminCustomerRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/chat", chatbotRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/homepage", homepageRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/address", addressRoutes);

// Test route
app.get("/", (req, res) => {
  res.send("Mobile Shop API running");
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Centralized error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);

  if (err.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: "Invalid Product ID format",
    });
  }

  if (err.message === "Not allowed by CORS") {
    return res
      .status(403)
      .json({ success: false, message: "Not allowed by CORS" });
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
