import { body } from "express-validator";

export const createOrderValidation = [
  body("addressId")
    .notEmpty()
    .withMessage("Address is required")
    .isMongoId()
    .withMessage("Invalid address"),

  body("deliverySlotId")
    .notEmpty()
    .withMessage("Delivery slot is required")
    .isMongoId()
    .withMessage("Invalid delivery slot"),

  body("deliveryDateKey")
    .notEmpty()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage("Invalid delivery date"),

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

export const reorderValidation = [
  body("mode")
    .notEmpty()
    .withMessage("Reorder mode is required")
    .isIn(["ALL", "SELECTED"])
    .withMessage("Reorder mode must be ALL or SELECTED"),

  body("sourceOrderId")
    .optional({ nullable: true })
    .isMongoId()
    .withMessage("Invalid source order"),

  body("items")
    .optional({ nullable: true })
    .isArray({ max: 40 })
    .withMessage("Reorder items must be an array with at most 40 items"),

  body("items.*.productId")
    .optional()
    .isMongoId()
    .withMessage("Invalid product in reorder items"),

  body("items.*.quantity")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Reorder quantity must be between 1 and 50"),
];
