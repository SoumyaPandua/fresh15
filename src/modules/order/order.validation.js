import { body } from "express-validator";

export const createOrderValidation = [
  body("addressId")
    .notEmpty()
    .withMessage("Address is required")
    .isMongoId()
    .withMessage("Invalid address"),

  body("paymentMethod")
    .notEmpty()
    .withMessage("Payment method is required")
    .isIn(["COD", "ONLINE"])
    .withMessage("Invalid payment method"),

  body("couponCode")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Invalid coupon"),

  body("notes")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Notes cannot exceed 500 characters"),
];

export const updateOrderStatusValidation = [
  body("orderStatus")
    .notEmpty()
    .withMessage("Order status is required")
    .isIn([
      "PENDING",
      "CONFIRMED",
      "PACKING",
      "READY_FOR_PICKUP",
      "OUT_FOR_DELIVERY",
      "DELIVERED",
      "CANCELLED",
    ])
    .withMessage("Invalid order status"),
];