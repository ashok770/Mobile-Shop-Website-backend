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
 * Dark-pattern heuristics for lab / demo (time-based + countdown).
 * Pass visible page text (or innerText snapshot); returns matched labels.
 */
function detectDarkPatternsFromText(text) {
  if (!text || typeof text !== "string") {
    return [];
  }

  const lowerText = text.toLowerCase();
  const patterns = [];

  if (
    lowerText.includes("offer ends") ||
    lowerText.includes("limited time") ||
    lowerText.includes("hurry") ||
    lowerText.includes("ending soon")
  ) {
    patterns.push("⚠️ Fake Urgency");
  }

  if (/\d{1,2}:\d{2}/.test(lowerText)) {
    patterns.push("⚠️ Countdown Timer Pressure");
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
