import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import connectDB from "./config/db.js";

// Routes
import adminRoutes from "./routes/adminRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";

// Init app
const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Database
connectDB();

// Routes
app.use("/api/admin", adminRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);

// Test route
app.get("/", (req, res) => {
  res.send("Mobile Shop API running");
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
