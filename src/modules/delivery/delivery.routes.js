import express from "express";

import authMiddleware from "../../middleware/auth.middleware.js";
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
  updateDeliveryStatus,
} from "./delivery.controller.js";

const router = express.Router();

router.use(authMiddleware);

router.get(
  "/",
  getAllDeliveries
);

router.get(
  "/:id",
  getDeliveryById
);

router.post(
  "/",
  createDeliveryValidation,
  validateRequest,
  createDelivery
);

router.patch(
  "/:id/assign",
  assignRiderValidation,
  validateRequest,
  assignRider
);

router.patch(
  "/:id/status",
  updateDeliveryStatusValidation,
  validateRequest,
  updateDeliveryStatus
);

router.delete(
  "/:id",
  deleteDelivery
);

export default router;