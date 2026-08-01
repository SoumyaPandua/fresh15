import express from "express";

import authMiddleware from "../../middleware/auth.middleware.js";
import validateRequest from "../../middleware/validateRequest.middleware.js";

import {
  applyCouponValidation,
  createCouponValidation,
  updateCouponStatusValidation,
} from "./coupon.validation.js";

import {
  applyCoupon,
  createCoupon,
  deleteCoupon,
  getAllCoupons,
  getCouponById,
  updateCoupon,
  updateCouponStatus,
} from "./coupon.controller.js";

const router = express.Router();

router.use(authMiddleware);

router.get(
  "/",
  getAllCoupons
);

router.get(
  "/:id",
  getCouponById
);

router.post(
  "/",
  createCouponValidation,
  validateRequest,
  createCoupon
);

router.post(
  "/apply",
  applyCouponValidation,
  validateRequest,
  applyCoupon
);

router.put(
  "/:id",
  createCouponValidation,
  validateRequest,
  updateCoupon
);

router.patch(
  "/:id/status",
  updateCouponStatusValidation,
  validateRequest,
  updateCouponStatus
);

router.delete(
  "/:id",
  deleteCoupon
);

export default router;