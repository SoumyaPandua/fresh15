import { body } from "express-validator";

export const createDeliveryValidation = [
  body("orderId")
    .notEmpty()
    .withMessage("Order ID is required")
    .isMongoId()
    .withMessage("Invalid Order ID"),

  body("estimatedDeliveryTime")
    .optional()
    .isISO8601()
    .withMessage("Invalid estimated delivery time"),

  body("notes")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Notes cannot exceed 500 characters"),
];

export const assignRiderValidation = [
  body("riderId")
    .notEmpty()
    .withMessage("Rider ID is required")
    .isMongoId()
    .withMessage("Invalid Rider ID"),
];

export const updateDeliveryStatusValidation = [
  body("status")
    .notEmpty()
    .withMessage("Status is required")
    .isIn([
      "ACCEPTED",
      "PICKED_UP",
      "OUT_FOR_DELIVERY",
      "DELIVERED",
      "REJECTED",
      "CANCELLED",
    ])
    .withMessage("Invalid delivery status"),
];

export const verifyDeliveryOtpValidation = [
  body("otp")
    .trim()
    .notEmpty()
    .withMessage("Delivery OTP is required")
    .matches(/^\d{6}$/)
    .withMessage("Delivery OTP must be 6 digits"),
];

export const uploadDeliveryProofValidation = [
  body("type")
    .isIn(["PHOTO", "SIGNATURE"])
    .withMessage("Proof type must be PHOTO or SIGNATURE"),
];

export const failDeliveryValidation = [
  body("reason")
    .isIn([
      "CUSTOMER_UNAVAILABLE",
      "CUSTOMER_REFUSED",
      "WRONG_ADDRESS",
      "PHONE_UNREACHABLE",
      "PAYMENT_ISSUE",
      "DAMAGED_ORDER",
      "SAFETY_ISSUE",
      "OTHER",
    ])
    .withMessage("Invalid failed delivery reason"),
  body("note")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Failure note cannot exceed 500 characters"),
];