import express from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import authorize from "../../middleware/authorize.middleware.js";
import validateRequest from "../../middleware/validateRequest.middleware.js";

import {
  createRefundRequest,
  getMyRefunds,
  getMyRefund,
  getAdminRefunds,
  processRefund,
  rejectRefund,
  completeManualRefund,
  razorpayRefundWebhook,
} from "./refund.controller.js";

import {
  createRefundRequestValidation,
  adminRefundListValidation,
  refundIdValidation,
  rejectRefundValidation,
  manualRefundValidation,
} from "./refund.validation.js";

const router = express.Router();

// Razorpay calls this endpoint without the Fresh15 auth token.
// The controller verifies x-razorpay-signature against the raw request body.
router.post("/webhook/razorpay", razorpayRefundWebhook);

router.use(authMiddleware);

router.post(
  "/request",
  createRefundRequestValidation,
  validateRequest,
  createRefundRequest
);

router.get("/mine", getMyRefunds);

router.get(
  "/mine/:refundId",
  refundIdValidation,
  validateRequest,
  getMyRefund
);

router.get(
  "/admin",
  authorize("ADMIN", "SUPER_ADMIN"),
  adminRefundListValidation,
  validateRequest,
  getAdminRefunds
);

router.post(
  "/admin/:refundId/process",
  authorize("ADMIN", "SUPER_ADMIN"),
  refundIdValidation,
  validateRequest,
  processRefund
);

router.post(
  "/admin/:refundId/reject",
  authorize("ADMIN", "SUPER_ADMIN"),
  rejectRefundValidation,
  validateRequest,
  rejectRefund
);

router.post(
  "/admin/:refundId/manual-complete",
  authorize("ADMIN", "SUPER_ADMIN"),
  manualRefundValidation,
  validateRequest,
  completeManualRefund
);

export default router;
