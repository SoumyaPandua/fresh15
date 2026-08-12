import { body } from "express-validator";

export const createCustomerValidation = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required"),

  body("email")
    .trim()
    .isEmail()
    .withMessage("Valid email is required"),

  body("phone")
    .optional()
    .trim(),

  body("city")
    .optional()
    .trim(),

  body("status")
    .optional()
    .isIn([
      "active",
      "inactive",
    ])
    .withMessage(
      "Invalid customer status"
    ),

  body("customerTier")
    .optional()
    .isIn([
      "STANDARD",
      "VIP",
    ])
    .withMessage(
      "Invalid customer tier"
    ),
];

export const updateCustomerStatusValidation =
  [
    body("status")
      .isIn([
        "active",
        "inactive",
      ])
      .withMessage(
        "Invalid customer status"
      ),
  ];

export const updateCustomerTierValidation =
  [
    body("tier")
      .isIn([
        "STANDARD",
        "VIP",
      ])
      .withMessage(
        "Invalid customer tier"
      ),
  ];