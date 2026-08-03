import express from "express";

import authMiddleware from "../../middleware/auth.middleware.js";
import validateRequest from "../../middleware/validateRequest.middleware.js";
import authorize from "../../middleware/authorize.middleware.js";

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
  authorize("ADMIN"),
  getAllCoupons
);

router.get(
  "/:id",
  authorize("ADMIN"),
  getCouponById
);

router.post(
  "/",
  authorize("ADMIN"),
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
  authorize("ADMIN"),
  createCouponValidation,
  validateRequest,
  updateCoupon
);

router.patch(
  "/:id/status",
  authorize("ADMIN"),
  updateCouponStatusValidation,
  validateRequest,
  updateCouponStatus
);

router.delete(
  "/:id",
  authorize("ADMIN"),
  deleteCoupon
);

export default router;