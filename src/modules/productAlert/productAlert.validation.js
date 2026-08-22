import { body, param } from "express-validator";

const mongoId = (field) =>
  param(field)
    .notEmpty()
    .withMessage(`${field} is required`)
    .isMongoId()
    .withMessage(`Invalid ${field}`);

export const productIdParamValidation = [mongoId("productId")];

export const upsertProductAlertValidation = [
  ...productIdParamValidation,

  body("backInStock")
    .optional()
    .isBoolean()
    .withMessage("backInStock must be boolean"),

  body("priceDrop")
    .optional()
    .isBoolean()
    .withMessage("priceDrop must be boolean"),

  body("targetPrice")
    .optional({ nullable: true })
    .isFloat({ min: 0 })
    .withMessage("targetPrice must be a non-negative number"),

  body("inAppEnabled")
    .optional()
    .isBoolean()
    .withMessage("inAppEnabled must be boolean"),

  body("emailEnabled")
    .optional()
    .isBoolean()
    .withMessage("emailEnabled must be boolean"),
];
