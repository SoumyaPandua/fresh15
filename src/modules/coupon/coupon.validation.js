import { body } from "express-validator";

export const createCouponValidation = [
  body("code")
    .trim()
    .notEmpty()
    .withMessage("Coupon code is required"),

  body("title")
    .trim()
    .notEmpty()
    .withMessage("Title is required"),

  body("discountType")
    .isIn([
      "PERCENTAGE",
      "FIXED",
    ])
    .withMessage("Invalid discount type"),

  body("discountValue")
    .isFloat({ gt: 0 })
    .withMessage("Discount value must be greater than 0"),

  body("minimumOrderAmount")
    .optional()
    .isFloat({ min: 0 }),

  body("maxDiscount")
    .optional()
    .isFloat({ min: 0 }),

  body("usageLimit")
    .optional()
    .isInt({ min: 0 }),

  body("validFrom")
    .isISO8601()
    .withMessage("Invalid validFrom date"),

  body("validUntil")
    .isISO8601()
    .withMessage("Invalid validUntil date"),
];

export const applyCouponValidation = [
  body("code")
    .trim()
    .notEmpty()
    .withMessage("Coupon code is required"),

  body("orderAmount")
    .isFloat({ gt: 0 })
    .withMessage("Order amount must be greater than 0"),
];

export const updateCouponStatusValidation = [
  body("isActive")
    .isBoolean()
    .withMessage("isActive must be boolean"),
];