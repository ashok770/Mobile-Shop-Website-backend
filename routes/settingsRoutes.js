import express from "express";
import { getPublicSettings, getAdminSettings, updateSettings } from "../controllers/settingsController.js";
import { adminProtect, adminOnly } from "../middleware/authMiddleware.js";

// Public router: mounted at /api/settings
const publicRouter = express.Router();
publicRouter.get("/", getPublicSettings);

// Admin router: mounted at /api/admin/settings
const adminRouter = express.Router();
adminRouter.use(adminProtect, adminOnly);

adminRouter.get("/", getAdminSettings);
adminRouter.put("/", updateSettings);

export { adminRouter as adminSettingsRoutes };
export default publicRouter;
