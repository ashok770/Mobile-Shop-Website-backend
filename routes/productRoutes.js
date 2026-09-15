import express from "express";
import {
  createProduct,
  getProducts,
  getOfferProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  getOfferSummary,
  bulkUpdateOffer,
} from "../controllers/productController.js";

import protect, { adminOnly, adminProtect, optionalAdmin } from "../middleware/authMiddleware.js";
import upload from "../middleware/upload.js";

const router = express.Router();

// Public (with optional admin draft detection)
router.get("/", optionalAdmin, getProducts);
router.get("/offers/summary", adminProtect, getOfferSummary);
router.get("/offers/:type", optionalAdmin, getOfferProducts);
router.get("/:id", optionalAdmin, getProductById);

// Admin (adminProtect + adminOnly)
router.post("/", adminProtect, adminOnly, upload.array("images", 5), createProduct);
router.patch("/bulk-offer", adminProtect, adminOnly, bulkUpdateOffer);
router.put(
  "/:id",
  adminProtect,
  adminOnly,
  upload.array("images", 5),
  updateProduct,
);
router.delete("/:id", adminProtect, adminOnly, deleteProduct);

export default router;
