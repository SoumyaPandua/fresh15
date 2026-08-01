import { body } from "express-validator";

export const createPaymentOrderValidation = [
  body("orderId")
    .notEmpty()
    .withMessage("Order ID is required")
    .isMongoId()
    .withMessage("Invalid Order ID"),
];

export const verifyPaymentValidation = [
  body("orderId")
    .notEmpty()
    .withMessage("Order ID is required")
    .isMongoId()
    .withMessage("Invalid Order ID"),

  body("razorpay_order_id")
    .notEmpty()
    .withMessage("Razorpay Order ID is required"),

  body("razorpay_payment_id")
    .notEmpty()
    .withMessage("Razorpay Payment ID is required"),

  body("razorpay_signature")
    .notEmpty()
    .withMessage("Razorpay Signature is required"),
];

export const paymentFailureValidation = [
  body("orderId")
    .notEmpty()
    .withMessage("Order ID is required")
    .isMongoId()
    .withMessage("Invalid Order ID"),

  body("reason")
    .notEmpty()
    .withMessage("Failure reason is required"),
];