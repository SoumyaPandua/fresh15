import express from "express";

import authMiddleware from "../../middleware/auth.middleware.js";
import validateRequest from "../../middleware/validateRequest.middleware.js";

import {
  createPaymentOrderValidation,
  paymentFailureValidation,
  verifyPaymentValidation,
} from "./payment.validation.js";

import {
  createPaymentOrder,
  getPaymentByOrder,
  paymentFailure,
  verifyPayment,
} from "./payment.controller.js";

const router = express.Router();

router.use(authMiddleware);

router.post(
  "/create-order",
  createPaymentOrderValidation,
  validateRequest,
  createPaymentOrder
);

router.post(
  "/verify",
  verifyPaymentValidation,
  validateRequest,
  verifyPayment
);

router.post(
  "/failure",
  paymentFailureValidation,
  validateRequest,
  paymentFailure
);

router.get(
  "/:orderId",
  getPaymentByOrder
);

export default router;