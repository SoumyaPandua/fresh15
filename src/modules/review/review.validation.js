import { body } from "express-validator";

export const createReviewValidation = [
  body("productId")
    .isMongoId()
    .withMessage("Invalid product"),

  body("orderId")
    .isMongoId()
    .withMessage("Invalid order"),

  body("rating")
    .isInt({
      min: 1,
      max: 5,
    })
    .withMessage("Rating must be between 1 and 5"),

  body("title")
    .optional()
    .isLength({
      max: 100,
    })
    .withMessage("Title cannot exceed 100 characters"),

  body("comment")
    .optional()
    .isLength({
      max: 1000,
    })
    .withMessage("Comment cannot exceed 1000 characters"),
];

export const updateReviewValidation = [
  body("rating")
    .optional()
    .isInt({
      min: 1,
      max: 5,
    }),

  body("title")
    .optional()
    .isLength({
      max: 100,
    }),

  body("comment")
    .optional()
    .isLength({
      max: 1000,
    }),
];