import { body } from "express-validator";

export const createProductValidation = [
  body("categoryId")
    .notEmpty()
    .withMessage("Category is required")
    .isMongoId()
    .withMessage("Invalid category"),

  body("name")
    .trim()
    .notEmpty()
    .withMessage("Product name is required")
    .isLength({ max: 150 })
    .withMessage("Product name cannot exceed 150 characters"),

  body("description")
    .optional()
    .isLength({ max: 1000 })
    .withMessage("Description cannot exceed 1000 characters"),

  body("unit")
    .notEmpty()
    .withMessage("Unit is required")
    .isIn([
      "KG",
      "GRAM",
      "LITER",
      "ML",
      "PIECE",
      "PACK",
      "DOZEN",
      "BUNDLE",
    ])
    .withMessage("Invalid unit"),

  body("weight")
    .notEmpty()
    .withMessage("Weight is required")
    .isFloat({ min: 0 })
    .withMessage("Invalid weight"),

  body("sku")
    .trim()
    .notEmpty()
    .withMessage("SKU is required"),

  body("mrp")
    .notEmpty()
    .withMessage("MRP is required")
    .isFloat({ min: 0 })
    .withMessage("Invalid MRP"),

  body("sellingPrice")
    .notEmpty()
    .withMessage("Selling price is required")
    .isFloat({ min: 0 })
    .withMessage("Invalid selling price"),

  body("stock")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Invalid stock"),

  body("isVeg")
    .optional()
    .isBoolean()
    .withMessage("isVeg must be boolean"),

  body("isFeatured")
    .optional()
    .isBoolean()
    .withMessage("isFeatured must be boolean"),

  body("tags")
    .optional()
    .isArray()
    .withMessage("Tags must be an array"),
];

export const updateProductValidation = [
  body("categoryId")
    .optional()
    .isMongoId()
    .withMessage("Invalid category"),

  body("name")
    .optional()
    .trim()
    .isLength({ max: 150 }),

  body("description")
    .optional()
    .isLength({ max: 1000 }),

  body("unit")
    .optional()
    .isIn([
      "KG",
      "GRAM",
      "LITER",
      "ML",
      "PIECE",
      "PACK",
      "DOZEN",
      "BUNDLE",
    ]),

  body("weight")
    .optional()
    .isFloat({ min: 0 }),

  body("sku")
    .optional()
    .trim(),

  body("mrp")
    .optional()
    .isFloat({ min: 0 }),

  body("sellingPrice")
    .optional()
    .isFloat({ min: 0 }),

  body("stock")
    .optional()
    .isInt({ min: 0 }),

  body("isVeg")
    .optional()
    .isBoolean(),

  body("isFeatured")
    .optional()
    .isBoolean(),

  body("isActive")
    .optional()
    .isBoolean(),

  body("tags")
    .optional()
    .isArray()
    .withMessage("Tags must be an array"),
];