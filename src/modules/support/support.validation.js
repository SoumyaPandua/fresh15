import { body } from "express-validator";

export const createSupportValidation = [
  body("subject")
    .trim()
    .notEmpty()
    .withMessage("Subject is required"),

  body("description")
    .trim()
    .notEmpty()
    .withMessage("Description is required"),

  body("category")
    .optional()
    .isIn([
      "ORDER",
      "PAYMENT",
      "DELIVERY",
      "ACCOUNT",
      "PRODUCT",
      "REFUND",
      "OTHER",
    ])
    .withMessage("Invalid category"),

  body("priority")
    .optional()
    .isIn([
      "LOW",
      "MEDIUM",
      "HIGH",
      "URGENT",
    ])
    .withMessage("Invalid priority"),
];

export const updateSupportStatusValidation = [
  body("status")
    .isIn([
      "OPEN",
      "IN_PROGRESS",
      "RESOLVED",
      "CLOSED",
    ])
    .withMessage("Invalid status"),

  body("adminRemark")
    .optional()
    .isLength({
      max: 1000,
    })
    .withMessage(
      "Admin remark cannot exceed 1000 characters"
    ),
];