import { body } from "express-validator";

export const createInventoryValidation = [
  body("productId")
    .notEmpty()
    .withMessage("Product is required")
    .isMongoId()
    .withMessage("Invalid product"),

  body("currentStock")
    .notEmpty()
    .withMessage("Current stock is required")
    .isInt({ min: 0 })
    .withMessage("Current stock must be zero or greater"),

  body("reservedStock")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Reserved stock must be zero or greater"),

  body("lowStockThreshold")
    .optional()
    .isInt({ min: 0 })
    .withMessage(
      "Low stock threshold must be zero or greater"
    ),
];

export const updateInventoryValidation = [
  body("currentStock")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Current stock must be zero or greater"),

  body("reservedStock")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Reserved stock must be zero or greater"),

  body("lowStockThreshold")
    .optional()
    .isInt({ min: 0 })
    .withMessage(
      "Low stock threshold must be zero or greater"
    ),
];

export const updateStockValidation = [
  body("currentStock")
    .notEmpty()
    .withMessage("Current stock is required")
    .isInt({ min: 0 })
    .withMessage("Current stock must be zero or greater"),
];