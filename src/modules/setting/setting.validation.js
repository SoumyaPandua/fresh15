import { body } from "express-validator";

export const updateSettingValidation = [
  body("supportEmail")
    .optional()
    .isEmail()
    .withMessage("Invalid email"),

  body("taxPercentage")
    .optional()
    .isFloat({
      min: 0,
    }),

  body("deliveryCharge")
    .optional()
    .isFloat({
      min: 0,
    }),

  body("freeDeliveryAbove")
    .optional()
    .isFloat({
      min: 0,
    }),

  body("codEnabled")
    .optional()
    .isBoolean(),

  body("onlinePaymentEnabled")
    .optional()
    .isBoolean(),

  body("maintenanceMode")
    .optional()
    .isBoolean(),
];