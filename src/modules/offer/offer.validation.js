import { body } from "express-validator";

const targetTypes = ["NONE", "SEARCH", "CATEGORY", "PRODUCT", "OFFER"];

const scheduleValidator = (value, { req }) => {
    if (!value) return true;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new Error("Invalid date");
    if (req.body?.startsAt && req.body?.endsAt && new Date(req.body.startsAt) >= new Date(req.body.endsAt)) {
        throw new Error("startsAt must be before endsAt");
    }
    return true;
};

export const createOfferValidation = [
    body("title").trim().notEmpty().isLength({ max: 150 }),
    body("description").optional().trim().isLength({ max: 500 }),
    body("discount").trim().notEmpty().isLength({ max: 50 }),
    body("category").trim().notEmpty().isLength({ max: 100 }),
    body("placement").optional().trim().isLength({ max: 50 }),
    body("ctaText").optional().trim().isLength({ max: 40 }),
    body("targetType").optional().isIn(targetTypes),
    body("targetValue").optional().trim().isLength({ max: 200 }),
    body("couponCode").optional().trim().isLength({ max: 50 }),
    body("priority").optional().isInt({ min: 0, max: 1000 }),
    body("startsAt").optional().custom(scheduleValidator),
    body("endsAt").optional().custom(scheduleValidator),
    body("isActive").optional().isBoolean(),
];

export const updateOfferValidation = [
    body("title").optional().trim().notEmpty().isLength({ max: 150 }),
    body("description").optional().trim().isLength({ max: 500 }),
    body("discount").optional().trim().notEmpty().isLength({ max: 50 }),
    body("category").optional().trim().notEmpty().isLength({ max: 100 }),
    body("placement").optional().trim().isLength({ max: 50 }),
    body("ctaText").optional().trim().isLength({ max: 40 }),
    body("targetType").optional().isIn(targetTypes),
    body("targetValue").optional().trim().isLength({ max: 200 }),
    body("couponCode").optional().trim().isLength({ max: 50 }),
    body("priority").optional().isInt({ min: 0, max: 1000 }),
    body("startsAt").optional().custom(scheduleValidator),
    body("endsAt").optional().custom(scheduleValidator),
    body("isActive").optional().isBoolean(),
];

export const updateOfferStatusValidation = [
    body("isActive").isBoolean(),
];
