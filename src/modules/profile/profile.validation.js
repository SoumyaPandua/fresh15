import { body } from "express-validator";

export const updateProfileValidation = [
  body("gender")
    .optional()
    .isIn(["MALE", "FEMALE", "OTHER"])
    .withMessage("Invalid gender"),

  body("dob")
    .optional()
    .isISO8601()
    .withMessage("Invalid date of birth"),

  body("vehicleType").optional().isString(),

  body("vehicleNumber").optional().isString(),

  body("drivingLicenseNumber").optional().isString(),

  body("bankName").optional().isString(),

  body("accountHolderName").optional().isString(),

  body("accountNumber").optional().isString(),

  body("ifscCode").optional().isString(),

  body("designation").optional().isString(),
];

export const changePasswordValidation = [
  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required"),

  body("newPassword")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters"),
];

export const updateAvatarValidation = [
  body("avatar")
    .notEmpty()
    .withMessage("Avatar is required"),
];