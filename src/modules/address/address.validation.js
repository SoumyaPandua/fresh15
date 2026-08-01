import { body } from "express-validator";

export const createAddressValidation = [
  body("fullName").notEmpty().withMessage("Full name is required"),

  body("phone").notEmpty().withMessage("Phone is required"),

  body("addressLine1").notEmpty().withMessage("Address Line 1 is required"),

  body("city").notEmpty().withMessage("City is required"),

  body("state").notEmpty().withMessage("State is required"),

  body("country").optional(),

  body("pincode").notEmpty().withMessage("Pincode is required"),

  body("addressType")
    .optional()
    .isIn(["HOME", "WORK", "OTHER"])
    .withMessage("Invalid address type"),
];

export const updateAddressValidation = createAddressValidation;