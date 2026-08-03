import express from "express";

import authMiddleware from "../../middleware/auth.middleware.js";
import validateRequest from "../../middleware/validateRequest.middleware.js";
import authorize from "../../middleware/authorize.middleware.js";

import {
  createOrderValidation,
  updateOrderStatusValidation,
} from "./order.validation.js";

import {
  createOrder,
  deleteOrder,
  getMyOrders,
  getOrderById,
  updateOrderStatus,
  getAllOrders
} from "./order.controller.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", getMyOrders);

router.get(
  "/admin/all",
  authorize("ADMIN"),
  getAllOrders
);

router.get("/:id", getOrderById);

router.post(
  "/",
  createOrderValidation,
  validateRequest,
  createOrder
);

router.patch(
  "/:id/status",
  authorize("ADMIN"),
  updateOrderStatusValidation,
  validateRequest,
  updateOrderStatus
);

router.delete("/:id", deleteOrder);

export default router;