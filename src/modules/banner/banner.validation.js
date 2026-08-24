import { body } from "express-validator";

const targetTypes = ["NONE", "SEARCH", "CATEGORY", "PRODUCT", "OFFER"];

const validateSchedule = (value, { req }) => {
    if (!value) return true;
    const start = req.body?.startsAt ? new Date(req.body.startsAt) : null;
    const end = req.body?.endsAt ? new Date(req.body.endsAt) : null;
    if (Number.isNaN(new Date(value).getTime())) throw new Error("Invalid date");
    if (start && end && start >= end) throw new Error("startsAt must be before endsAt");
    return true;
};

export const createBannerValidation = [
    body("title").trim().notEmpty().withMessage("Banner title is required").isLength({ max: 150 }),
    body("subtitle").optional().trim().isLength({ max: 300 }),
    body("placement").optional().trim().isLength({ max: 100 }),
    body("ctaText").optional().trim().isLength({ max: 40 }),
    body("targetType").optional().isIn(targetTypes).withMessage("Invalid banner target type"),
    body("targetValue").optional().trim().isLength({ max: 200 }),
    body("priority").optional().isInt({ min: 0, max: 1000 }).withMessage("Priority must be between 0 and 1000"),
    body("startsAt").optional().custom(validateSchedule),
    body("endsAt").optional().custom(validateSchedule),
    body("isActive").optional().isBoolean().withMessage("isActive must be boolean"),
];

export const updateBannerValidation = [
    body("title").optional().trim().notEmpty().isLength({ max: 150 }),
    body("subtitle").optional().trim().isLength({ max: 300 }),
    body("placement").optional().trim().isLength({ max: 100 }),
    body("ctaText").optional().trim().isLength({ max: 40 }),
    body("targetType").optional().isIn(targetTypes).withMessage("Invalid banner target type"),
    body("targetValue").optional().trim().isLength({ max: 200 }),
    body("priority").optional().isInt({ min: 0, max: 1000 }),
    body("startsAt").optional().custom(validateSchedule),
    body("endsAt").optional().custom(validateSchedule),
    body("isActive").optional().isBoolean(),
];

export const updateBannerStatusValidation = [
    body("isActive").isBoolean().withMessage("isActive must be boolean"),
];
