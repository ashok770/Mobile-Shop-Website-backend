import express from "express";
import protect from "../middleware/authMiddleware.js";
import { getProfile, updateProfile } from "../controllers/profileController.js";

const router = express.Router();

router.get("/", protect, getProfile);

router.put("/", protect, updateProfile);

export default router;
