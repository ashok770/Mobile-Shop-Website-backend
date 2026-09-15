import express from "express";
import {
  getPublicBrands,
  getAdminBrands,
  createBrand,
  updateBrand,
  deleteBrand,
} from "../controllers/brandController.js";
import { adminProtect, adminOnly } from "../middleware/authMiddleware.js";
import { uploadBrandLogo } from "../middleware/upload.js";

// Public router: mounted at /api/brands
const publicRouter = express.Router();
publicRouter.get("/", getPublicBrands);

// Admin router: mounted at /api/admin/brands
const adminRouter = express.Router();
adminRouter.use(adminProtect, adminOnly);

adminRouter.get("/", getAdminBrands);
adminRouter.post("/", uploadBrandLogo.single("logo"), createBrand);
adminRouter.put("/:id", uploadBrandLogo.single("logo"), updateBrand);
adminRouter.delete("/:id", deleteBrand);

export { adminRouter as adminBrandRoutes };
export default publicRouter;
