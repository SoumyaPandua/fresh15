import express from "express";
import { body } from "express-validator";
import authMiddleware from "../../middleware/auth.middleware.js";
import authorize from "../../middleware/authorize.middleware.js";
import validateRequest from "../../middleware/validateRequest.middleware.js";
import { redisActionRateLimit } from "../../middleware/rateLimit.middleware.js";
import { applyReferral, getAdminLoyaltyLedger, getAdminLoyaltySummary, getMyLoyalty, previewRedemption } from "./loyalty.controller.js";

const router = express.Router();
router.use(authMiddleware);

router.get("/admin/summary", authorize("ADMIN", "SUPER_ADMIN"), getAdminLoyaltySummary);
router.get("/admin/ledger", authorize("ADMIN", "SUPER_ADMIN"), getAdminLoyaltyLedger);
router.get("/me", authorize("CUSTOMER"), getMyLoyalty);
router.post("/referral/apply", authorize("CUSTOMER"), redisActionRateLimit({ name: "referral-apply", max: 5, windowSeconds: 86400 }), body("code").trim().isLength({ min: 6, max: 32 }), validateRequest, applyReferral);
router.post("/redemption/preview", authorize("CUSTOMER"), redisActionRateLimit({ name: "loyalty-preview", max: 30, windowSeconds: 60 }), body("subtotal").isFloat({ min: 0 }), body("points").isInt({ min: 0 }), validateRequest, previewRedemption);

export default router;
