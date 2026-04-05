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

/**
 * Dark-pattern heuristics (demo / extension lab). Pass visible page text.
 */
function detectDarkPatternsFromText(text) {
  if (!text || typeof text !== "string") {
    return [];
  }

  const patterns = [];
  const lowerText = text.toLowerCase();

  // Fake urgency (stock pressure)
  if (
    lowerText.includes("only") &&
    (lowerText.includes("left") || lowerText.includes("stock"))
  ) {
    patterns.push("⚠️ Fake Scarcity");
  }

  // Time pressure
  if (
    lowerText.includes("offer ends") ||
    lowerText.includes("limited time") ||
    lowerText.includes("hurry")
  ) {
    patterns.push("⚠️ Fake Urgency");
  }

  // Countdown timer (regex)
  if (/\d{1,2}:\d{2}/.test(lowerText)) {
    patterns.push("⚠️ Countdown Timer Pressure");
  }

  // Social pressure
  if (
    lowerText.includes("people are viewing") ||
    lowerText.includes("people viewing")
  ) {
    patterns.push("⚠️ Social Pressure");
  }

  return patterns;
}

app.post("/api/detect-dark-patterns", (req, res) => {
  try {
    const raw = req.body?.text ?? req.body?.html ?? "";
    const text = typeof raw === "string" ? raw : String(raw ?? "");
    const patterns = detectDarkPatternsFromText(text);
    res.json({ patterns });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Detection failed", patterns: [] });
  }
});

// Test route
app.get("/", (req, res) => {
  res.send("Mobile Shop API running");
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
