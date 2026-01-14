import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import adminRoutes from "./routes/adminRoutes.js";
import bcrypt from "bcryptjs";
import Admin from "./models/Admin.js";
import productRoutes from "./routes/productRoutes.js";

dotenv.config();
connectDB();

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/admin", adminRoutes);
app.use("/api/products", productRoutes);

app.get("/", (req, res) => {
  res.send("Mobile Shop API running...");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

const createAdmin = async () => {
  const exists = await Admin.findOne({ username: "admin" });
  if (!exists) {
    const hashedPassword = await bcrypt.hash("admin123", 10);
    await Admin.create({
      username: "admin",
      password: hashedPassword,
    });
    console.log("Admin created");
  }
};

createAdmin();
