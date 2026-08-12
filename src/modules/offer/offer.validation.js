import { body } from "express-validator";

export const createOfferValidation = [
    body("title")
        .trim()
        .notEmpty()
        .withMessage("Offer title is required")
        .isLength({ max: 150 })
        .withMessage("Offer title cannot exceed 150 characters"),

    body("description")
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage("Offer description cannot exceed 500 characters"),

    body("discount")
        .trim()
        .notEmpty()
        .withMessage("Discount label is required")
        .isLength({ max: 50 })
        .withMessage("Discount label cannot exceed 50 characters"),

    body("category")
        .trim()
        .notEmpty()
        .withMessage("Offer category is required")
        .isLength({ max: 100 })
        .withMessage("Offer category cannot exceed 100 characters"),

    body("isActive")
        .optional()
        .isBoolean()
        .withMessage("isActive must be boolean"),
];

export const updateOfferValidation = [
    body("title")
        .optional()
        .trim()
        .notEmpty()
        .withMessage("Offer title cannot be empty")
        .isLength({ max: 150 }),

    body("description")
        .optional()
        .trim()
        .isLength({ max: 500 }),

    body("discount")
        .optional()
        .trim()
        .notEmpty()
        .withMessage("Discount label cannot be empty")
        .isLength({ max: 50 }),

    body("category")
        .optional()
        .trim()
        .notEmpty()
        .withMessage("Offer category cannot be empty")
        .isLength({ max: 100 }),

    body("isActive")
        .optional()
        .isBoolean()
        .withMessage("isActive must be boolean"),
];

export const updateOfferStatusValidation = [
    body("isActive")
        .isBoolean()
        .withMessage("isActive must be boolean"),
];