import express from "express";
import {
  createProduct,
  getProducts,
  updateProduct,
  deleteProduct,
} from "../controllers/productController.js";

import protect, { adminOnly } from "../middleware/authMiddleware.js";
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

// Admin (protect + adminOnly)
router.post("/", protect, adminOnly, upload.array("images", 5), createProduct);
router.put(
  "/:id",
  protect,
  adminOnly,
  upload.array("images", 5),
  updateProduct,
);
router.delete("/:id", protect, adminOnly, deleteProduct);

export default router;
