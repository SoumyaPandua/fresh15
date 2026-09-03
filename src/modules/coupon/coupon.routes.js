import express from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import validateRequest from "../../middleware/validateRequest.middleware.js";
import authorize from "../../middleware/authorize.middleware.js";
import { redisActionRateLimit } from "../../middleware/rateLimit.middleware.js";
import { applyCouponValidation, createCouponValidation, updateCouponStatusValidation } from "./coupon.validation.js";
import { applyCoupon, createCoupon, deleteCoupon, getAllCoupons, getCouponById, updateCoupon, updateCouponStatus } from "./coupon.controller.js";

const router = express.Router();
router.use(authMiddleware);

router.get("/", authorize("ADMIN"), getAllCoupons);
router.get("/:id", authorize("ADMIN"), getCouponById);
router.post("/", authorize("ADMIN"), redisActionRateLimit({ name: "coupon-create", max: 30, windowSeconds: 60 }), createCouponValidation, validateRequest, createCoupon);
router.post("/apply", redisActionRateLimit({ name: "coupon-apply", max: 20, windowSeconds: 60 }), applyCouponValidation, validateRequest, applyCoupon);
router.put("/:id", authorize("ADMIN"), redisActionRateLimit({ name: "coupon-update", max: 60, windowSeconds: 60 }), createCouponValidation, validateRequest, updateCoupon);
router.patch("/:id/status", authorize("ADMIN"), redisActionRateLimit({ name: "coupon-status", max: 60, windowSeconds: 60 }), updateCouponStatusValidation, validateRequest, updateCouponStatus);
router.delete("/:id", authorize("ADMIN"), redisActionRateLimit({ name: "coupon-delete", max: 30, windowSeconds: 60 }), deleteCoupon);

export default router;
