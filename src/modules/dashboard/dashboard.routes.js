import express from "express";

import authMiddleware from "../../middleware/auth.middleware.js";

import {
  getAdminDashboard,
  getCustomerDashboard,
  getSellerDashboard,
} from "./dashboard.controller.js";

const router = express.Router();

router.use(authMiddleware);

router.get(
  "/admin",
  getAdminDashboard
);

router.get(
  "/seller",
  getSellerDashboard
);

router.get(
  "/customer",
  getCustomerDashboard
);

export default router;