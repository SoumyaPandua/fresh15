import { body } from "express-validator";

export const createBannerValidation = [
    body("title").trim().notEmpty().withMessage("Banner title is required").isLength({ max: 150 }).withMessage("Banner title cannot exceed 150 characters"),
    body("subtitle").optional().trim().isLength({ max: 300 }).withMessage("Banner subtitle cannot exceed 300 characters"),
    body("placement").trim().notEmpty().withMessage("Banner placement is required").isLength({ max: 100 }).withMessage("Banner placement cannot exceed 100 characters"),
    body("isActive").optional().isBoolean().withMessage("isActive must be boolean"),
];

export const updateBannerValidation = [
    body("title").optional().trim().notEmpty().withMessage("Banner title cannot be empty").isLength({ max: 150 }),
    body("subtitle").optional().trim().isLength({ max: 300 }),
    body("placement").optional().trim().notEmpty().withMessage("Banner placement cannot be empty").isLength({ max: 100 }),
    body("isActive").optional().isBoolean().withMessage("isActive must be boolean"),
];

export const updateBannerStatusValidation = [
    body("isActive").isBoolean().withMessage("isActive must be boolean"),
];