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