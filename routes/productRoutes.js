import express from "express";
import {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
} from "../controllers/productController.js";

import protect, { adminOnly, adminProtect } from "../middleware/authMiddleware.js";
import upload from "../middleware/upload.js";
import Product from "../models/Product.js";

const router = express.Router();

// Public
router.get("/", getProducts);

// GET products by offer
router.get("/offers/:type", async (req, res) => {
  const { type } = req.params;

  const products = await Product.find({
    offerType: type,
  });

  res.json(products);
});

// GET single product by ID
router.get("/:id", getProductById);

// Admin (adminProtect + adminOnly)
router.post("/", adminProtect, adminOnly, upload.array("images", 5), createProduct);
router.put(
  "/:id",
  adminProtect,
  adminOnly,
  upload.array("images", 5),
  updateProduct,
);
router.delete("/:id", adminProtect, adminOnly, deleteProduct);

export default router;
