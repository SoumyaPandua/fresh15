import express from "express";

import authMiddleware from "../../middleware/auth.middleware.js";
import validateRequest from "../../middleware/validateRequest.middleware.js";
import authorize from "../../middleware/authorize.middleware.js";

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
  reconcilePayment,
  getCodReport,
  getRazorpayReport
} from "./payment.controller.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/admin/cod-report", authorize("ADMIN", "SUPER_ADMIN"), getCodReport);
router.get("/admin/razorpay-report", authorize("ADMIN", "SUPER_ADMIN"), getRazorpayReport);

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
  "/reconcile",
  createPaymentOrderValidation,
  validateRequest,
  reconcilePayment
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