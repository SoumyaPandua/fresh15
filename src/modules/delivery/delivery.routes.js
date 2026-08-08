import express from "express";

import authMiddleware from "../../middleware/auth.middleware.js";
import authorize from "../../middleware/authorize.middleware.js";
import validateRequest from "../../middleware/validateRequest.middleware.js";

import {
  assignRiderValidation,
  createDeliveryValidation,
  updateDeliveryStatusValidation,
} from "./delivery.validation.js";

import {
  assignRider,
  createDelivery,
  deleteDelivery,
  getAllDeliveries,
  getDeliveryById,
  getMyActiveDelivery,
  getMyDeliveries,
  updateDeliveryStatus,
  getCustomerDeliveryByOrder,
  getDeliveryRoute,
} from "./delivery.controller.js";

const router = express.Router();

router.use(authMiddleware);

/* ---------------- Partner ---------------- */

router.get(
  "/my/active",
  authorize("PARTNER"),
  getMyActiveDelivery
);

router.get(
  "/my",
  authorize("PARTNER"),
  getMyDeliveries
);

/* ---------------- Admin ---------------- */

router.get(
  "/",
  authorize("ADMIN", "SUPER_ADMIN"),
  getAllDeliveries
);

router.post(
  "/",
  authorize("ADMIN", "SUPER_ADMIN"),
  createDeliveryValidation,
  validateRequest,
  createDelivery
);

router.patch(
  "/:id/assign",
  authorize("ADMIN", "SUPER_ADMIN"),
  assignRiderValidation,
  validateRequest,
  assignRider
);

/* ---------------- Shared ---------------- */

router.patch(
  "/:id/status",
  authorize("ADMIN", "SUPER_ADMIN", "PARTNER"),
  updateDeliveryStatusValidation,
  validateRequest,
  updateDeliveryStatus
);

router.get(
  "/order/:orderId",
  authorize("CUSTOMER"),
  getCustomerDeliveryByOrder
);

router.get(
  "/:id/route",
  authorize(
    "ADMIN",
    "SUPER_ADMIN",
    "PARTNER",
    "CUSTOMER"
  ),
  getDeliveryRoute
);

router.get(
  "/:id",
  authorize("ADMIN", "SUPER_ADMIN", "PARTNER"),
  getDeliveryById
);

router.delete(
  "/:id",
  authorize("ADMIN", "SUPER_ADMIN"),
  deleteDelivery
);

export default router;