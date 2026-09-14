import express from "express";
import {
  getAdminCustomers,
  getAdminCustomerById,
  updateCustomerStatus,
} from "../controllers/adminCustomerController.js";
import { adminProtect, adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

// ===== Admin Customer Management Endpoints (adminProtect + adminOnly) =====

// GET list of all customers with search, filter, and pagination
router.get("/", adminProtect, adminOnly, getAdminCustomers);

// GET single customer profile details, addresses, and order stats
router.get("/:id", adminProtect, adminOnly, getAdminCustomerById);

// PUT update customer account status (ACTIVE | DISABLED | SUSPENDED)
router.put("/:id/status", adminProtect, adminOnly, updateCustomerStatus);

export default router;
