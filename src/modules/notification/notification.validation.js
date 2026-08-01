import { body } from "express-validator";

export const createNotificationValidation = [
  body("userId")
    .notEmpty()
    .withMessage("User ID is required")
    .isMongoId()
    .withMessage("Invalid User ID"),

  body("title")
    .notEmpty()
    .withMessage("Title is required"),

  body("message")
    .notEmpty()
    .withMessage("Message is required"),

  body("type")
    .notEmpty()
    .withMessage("Notification type is required")
    .isIn([
      "WELCOME",
      "OTP",
      "PASSWORD_RESET",
      "ORDER_PLACED",
      "PAYMENT_SUCCESS",
      "PAYMENT_FAILED",
      "ORDER_CONFIRMED",
      "RIDER_ASSIGNED",
      "OUT_FOR_DELIVERY",
      "DELIVERED",
      "CANCELLED",
      "PROMOTIONAL",
    ])
    .withMessage("Invalid notification type"),

  body("channel")
    .optional()
    .isIn([
      "IN_APP",
      "EMAIL",
      "SMS",
      "PUSH",
    ])
    .withMessage("Invalid notification channel"),
];