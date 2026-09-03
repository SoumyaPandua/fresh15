import express from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import authorize from "../../middleware/authorize.middleware.js";
import validateRequest from "../../middleware/validateRequest.middleware.js";
import { redisActionRateLimit } from "../../middleware/rateLimit.middleware.js";
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
import { createRefundRequestValidation, adminRefundListValidation, refundIdValidation, rejectRefundValidation, manualRefundValidation } from "./refund.validation.js";

const router = express.Router();

router.post("/webhook/razorpay", razorpayRefundWebhook);
router.use(authMiddleware);

router.post("/request", redisActionRateLimit({ name: "refund-request", max: 3, windowSeconds: 3600 }), createRefundRequestValidation, validateRequest, createRefundRequest);
router.get("/mine", getMyRefunds);
router.get("/mine/:refundId", refundIdValidation, validateRequest, getMyRefund);
router.get("/admin", authorize("ADMIN", "SUPER_ADMIN"), adminRefundListValidation, validateRequest, getAdminRefunds);
router.post("/admin/:refundId/process", authorize("ADMIN", "SUPER_ADMIN"), redisActionRateLimit({ name: "refund-process", max: 60, windowSeconds: 60 }), refundIdValidation, validateRequest, processRefund);
router.post("/admin/:refundId/reject", authorize("ADMIN", "SUPER_ADMIN"), redisActionRateLimit({ name: "refund-reject", max: 60, windowSeconds: 60 }), rejectRefundValidation, validateRequest, rejectRefund);
router.post("/admin/:refundId/manual-complete", authorize("ADMIN", "SUPER_ADMIN"), redisActionRateLimit({ name: "refund-manual", max: 30, windowSeconds: 60 }), manualRefundValidation, validateRequest, completeManualRefund);

export default router;
