import { body } from "express-validator";

export const updateProfileValidation = [
  // Common User fields
  body("name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Name cannot be empty"),

  body("email")
    .optional()
    .trim()
    .isEmail()
    .withMessage("Invalid email"),

  body("phone")
    .optional()
    .trim()
    .isLength({ min: 10, max: 15 })
    .withMessage("Invalid phone number"),

  // Common Profile fields
  body("gender")
    .optional()
    .isIn(["MALE", "FEMALE", "OTHER"])
    .withMessage("Invalid gender"),

  body("dob")
    .optional()
    .isISO8601()
    .withMessage("Invalid date of birth"),

  // Customer
  body("preferences")
    .optional()
    .isObject()
    .withMessage("Preferences must be an object"),

  // Partner
  body("vehicleType")
    .optional()
    .trim()
    .isString(),

  body("vehicleNumber")
    .optional()
    .trim()
    .isString(),

  body("drivingLicenseNumber")
    .optional()
    .trim()
    .isString(),

  body("bankName")
    .optional()
    .trim()
    .isString(),

  body("accountHolderName")
    .optional()
    .trim()
    .isString(),

  body("accountNumber")
    .optional()
    .trim()
    .isString(),

  body("ifscCode")
    .optional()
    .trim()
    .isString(),

  // Admin
  body("designation")
    .optional()
    .trim()
    .isString(),

  body("notificationSettings")
    .optional()
    .isObject()
    .withMessage("Notification settings must be an object"),
];

export const changePasswordValidation = [
  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required"),

  body("newPassword")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters"),
];

export const updatePartnerAvailabilityValidation = [
  body("isOnline")
    .exists()
    .withMessage("Availability status is required")
    .isBoolean()
    .withMessage("isOnline must be true or false"),
];