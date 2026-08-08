import { body } from "express-validator";

export const createAddressValidation = [
  body("fullName").notEmpty().withMessage("Full name is required"),

  body("phone").notEmpty().withMessage("Phone is required"),

  body("addressLine1").notEmpty().withMessage("Address Line 1 is required"),

  body("city").notEmpty().withMessage("City is required"),

  body("state").notEmpty().withMessage("State is required"),

  body("country").optional(),

  body("pincode").notEmpty().withMessage("Pincode is required"),

  body("latitude")
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage("Latitude must be between -90 and 90"),

  body("longitude")
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage("Longitude must be between -180 and 180"),

  body("addressType")
    .optional()
    .isIn(["HOME", "WORK", "OTHER"])
    .withMessage("Invalid address type"),
];

export const updateAddressValidation = createAddressValidation;