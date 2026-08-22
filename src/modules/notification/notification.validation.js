import { body } from "express-validator";

export const createNotificationValidation = [
  body("userId")
    .notEmpty()
    .withMessage("User ID is required")
    .isMongoId()
    .withMessage("Invalid User ID"),

  body("title")
    .trim()
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ max: 150 })
    .withMessage(
      "Title cannot exceed 150 characters"
    ),

  body("message")
    .trim()
    .notEmpty()
    .withMessage("Message is required")
    .isLength({ max: 1000 })
    .withMessage(
      "Message cannot exceed 1000 characters"
    ),

  body("type")
    .notEmpty()
    .withMessage("Notification type is required")
    .isIn([
      "WELCOME",
      "OTP",
      "PASSWORD_RESET",

      "ORDER_PLACED",
      "ORDER_CONFIRMED",
      "ORDER_CANCELLED",

      "PAYMENT_SUCCESS",
      "PAYMENT_FAILED",
      "REFUND_INITIATED",
      "REFUND_COMPLETED",

      "RIDER_ASSIGNED",
      "DELIVERY_ACCEPTED",
      "PICKED_UP",
      "OUT_FOR_DELIVERY",
      "DELIVERED",
      "DELIVERY_REJECTED",

      "REVIEW_CREATED",

      "BACK_IN_STOCK",
      "PRICE_DROP",

      "PROMOTIONAL",
      "GENERAL",
    ])
    .withMessage(
      "Invalid notification type"
    ),

  body("channel")
    .optional()
    .isIn([
      "IN_APP",
      "EMAIL",
      "SMS",
      "PUSH",
    ])
    .withMessage(
      "Invalid notification channel"
    ),

  body("metadata")
    .optional()
    .isObject()
    .withMessage(
      "Metadata must be an object"
    ),
];