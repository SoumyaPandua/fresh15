import express from "express";

import authMiddleware from "../../middleware/auth.middleware.js";
import authorize from "../../middleware/authorize.middleware.js";

import {
  getCustomers,
  getCustomerSummary,
  createCustomer,
  updateCustomerStatus,
  updateCustomerTier,
  deleteCustomer,
} from "./customer.controller.js";

const router = express.Router();

router.use(authMiddleware);

router.use(
  authorize(
    "ADMIN",
    "SUPER_ADMIN"
  )
);

router.get(
  "/summary",
  getCustomerSummary
);

router.get(
  "/",
  getCustomers
);

router.post(
  "/",
  createCustomer
);

router.patch(
  "/:id/status",
  updateCustomerStatus
);

router.patch(
  "/:id/tier",
  updateCustomerTier
);

router.delete(
  "/:id",
  deleteCustomer
);

export default router;