import { body } from "express-validator";

const substitutionTypes = [
  "CALL_ME",
  "BEST_SIMILAR_ITEM",
  "DO_NOT_SUBSTITUTE",
  "SPECIFIC_ITEM",
];

const substitutionPreferenceValidation = [
  body("substitutionPreference.type")
    .optional()
    .isIn(substitutionTypes)
    .withMessage("Invalid substitution preference type"),

  body("substitutionPreference.preferredReplacementProductId")
    .optional({ nullable: true })
    .isMongoId()
    .withMessage("Invalid replacement product"),
];

export const addToCartValidation = [
  body("productId")
    .notEmpty()
    .withMessage("Product is required")
    .isMongoId()
    .withMessage("Invalid product"),

  body("quantity")
    .notEmpty()
    .withMessage("Quantity is required")
    .isInt({ min: 1 })
    .withMessage("Quantity must be at least 1"),

  ...substitutionPreferenceValidation,
];

export const updateCartItemValidation = [
  body("quantity")
    .notEmpty()
    .withMessage("Quantity is required")
    .isInt({ min: 1 })
    .withMessage("Quantity must be at least 1"),
];

export const updateCartItemSubstitutionValidation = [
  body("substitutionPreference")
    .notEmpty()
    .withMessage("Substitution preference is required"),

  ...substitutionPreferenceValidation,
];