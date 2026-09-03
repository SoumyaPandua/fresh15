import express from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import validateRequest from "../../middleware/validateRequest.middleware.js";
import authorize from "../../middleware/authorize.middleware.js";
import { redisActionRateLimit } from "../../middleware/rateLimit.middleware.js";
import { createPaymentOrderValidation, paymentFailureValidation, verifyPaymentValidation } from "./payment.validation.js";
import { createPaymentOrder, getPaymentByOrder, paymentFailure, verifyPayment, reconcilePayment, getCodReport, getRazorpayReport } from "./payment.controller.js";

const router = express.Router();
router.use(authMiddleware);

router.get("/admin/cod-report", authorize("ADMIN", "SUPER_ADMIN"), getCodReport);
router.get("/admin/razorpay-report", authorize("ADMIN", "SUPER_ADMIN"), getRazorpayReport);

router.post("/create-order", redisActionRateLimit({ name: "payment-create", max: 10, windowSeconds: 60 }), createPaymentOrderValidation, validateRequest, createPaymentOrder);
router.post("/verify", redisActionRateLimit({ name: "payment-verify", max: 10, windowSeconds: 60 }), verifyPaymentValidation, validateRequest, verifyPayment);
router.post("/reconcile", redisActionRateLimit({ name: "payment-reconcile", max: 10, windowSeconds: 60 }), createPaymentOrderValidation, validateRequest, reconcilePayment);
router.post("/failure", redisActionRateLimit({ name: "payment-failure", max: 20, windowSeconds: 60 }), paymentFailureValidation, validateRequest, paymentFailure);
router.get("/:orderId", getPaymentByOrder);

export default router;
