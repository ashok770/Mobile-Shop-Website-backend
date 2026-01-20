import express from "express";
import {
  createProduct,
  getProducts,
  updateProduct,
  deleteProduct,
} from "../controllers/productController.js";

import protect from "../middleware/authMiddleware.js";
import upload from "../middleware/upload.js";
import Product from "../models/Product.js";

const router = express.Router();

// Public
router.get("/", getProducts);

// GET products by offer
router.get("/offers/:type", async (req, res) => {
  const { type } = req.params;

  const products = await Product.find({
    offerType: type
  });

  res.json(products);
});

// Admin
router.post("/", protect, upload.single("image"), createProduct);
router.put("/:id", protect, upload.single("image"), updateProduct);
router.delete("/:id", protect, deleteProduct);

export default router;
