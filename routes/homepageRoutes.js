import express from "express";
import {
  getHomepageConfig,
  updateHomepageConfig,
} from "../controllers/homepageController.js";
import { adminOnly, adminProtect } from "../middleware/authMiddleware.js";
import { uploadBanners } from "../middleware/upload.js";

const router = express.Router();

router.get("/", getHomepageConfig);
router.put(
  "/",
  adminProtect,
  adminOnly,
  uploadBanners.array("images", 10),
  updateHomepageConfig
);

export default router;
