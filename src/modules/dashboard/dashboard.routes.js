import express from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import authorize from "../../middleware/authorize.middleware.js";
import { getAdminDashboard, getCustomerDashboard, getSellerDashboard } from "./dashboard.controller.js";

const router = express.Router();
router.use(authMiddleware);
router.get("/admin", authorize("ADMIN", "SUPER_ADMIN"), getAdminDashboard);
router.get("/seller", authorize("ADMIN", "SUPER_ADMIN", "SELLER"), getSellerDashboard);
router.get("/customer", authorize("CUSTOMER"), getCustomerDashboard);
export default router;
