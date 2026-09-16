import express from "express";
import {
  getPublicServices,
  getAdminServices,
  createService,
  updateService,
  deleteService,
} from "../controllers/serviceController.js";
import { adminProtect, adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public route
router.get("/", getPublicServices);

export default router;

export const adminServiceRoutes = express.Router();

// Admin routes (mounted at /api/admin/services)
adminServiceRoutes.get("/", adminProtect, adminOnly, getAdminServices);
adminServiceRoutes.post("/", adminProtect, adminOnly, createService);
adminServiceRoutes.put("/:id", adminProtect, adminOnly, updateService);
adminServiceRoutes.delete("/:id", adminProtect, adminOnly, deleteService);
