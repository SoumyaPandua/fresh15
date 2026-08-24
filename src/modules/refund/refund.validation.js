import { body, param, query } from "express-validator";

export const createRefundRequestValidation = [
  body("orderId")
    .notEmpty()
    .withMessage("Order ID is required")
    .isMongoId()
    .withMessage("Invalid Order ID"),
  body("amount")
    .notEmpty()
    .withMessage("Refund amount is required")
    .isFloat({ gt: 0 })
    .withMessage("Refund amount must be greater than zero"),
  body("reason")
    .trim()
    .notEmpty()
    .withMessage("Refund reason is required")
    .isLength({ max: 500 })
    .withMessage("Refund reason cannot exceed 500 characters"),
];

export const adminRefundListValidation = [
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
  query("status").optional().isIn([
    "REQUESTED",
    "APPROVED",
    "PROCESSING",
    "PROCESSED",
    "FAILED",
    "REJECTED",
    "MANUAL_REQUIRED",
    "REVERSED",
  ]),
  query("search").optional().trim().isLength({ max: 100 }),
];

export const refundIdValidation = [
  param("refundId")
    .notEmpty()
    .withMessage("Refund ID is required")
    .isMongoId()
    .withMessage("Invalid refund ID"),
];

export const rejectRefundValidation = [
  ...refundIdValidation,
  body("reason")
    .trim()
    .notEmpty()
    .withMessage("Rejection reason is required")
    .isLength({ max: 500 })
    .withMessage("Rejection reason cannot exceed 500 characters"),
];

export const manualRefundValidation = [
  ...refundIdValidation,
  body("reference")
    .trim()
    .notEmpty()
    .withMessage("Manual refund reference is required")
    .isLength({ max: 200 })
    .withMessage("Manual refund reference cannot exceed 200 characters"),
];
