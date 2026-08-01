import { body } from "express-validator";

export const createDeliveryValidation = [
  body("orderId")
    .notEmpty()
    .withMessage("Order ID is required")
    .isMongoId()
    .withMessage("Invalid Order ID"),
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
      "PENDING",
      "ASSIGNED",
      "ACCEPTED",
      "PICKED_UP",
      "OUT_FOR_DELIVERY",
      "DELIVERED",
      "REJECTED",
      "CANCELLED",
    ])
    .withMessage("Invalid delivery status"),
];