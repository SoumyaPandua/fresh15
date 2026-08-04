import { body } from "express-validator";

export const createReviewValidation = [
  body("productId")
    .notEmpty()
    .withMessage("Product ID is required")
    .isMongoId()
    .withMessage("Invalid Product ID"),

  body("orderId")
    .notEmpty()
    .withMessage("Order ID is required")
    .isMongoId()
    .withMessage("Invalid Order ID"),

  body("rating")
    .notEmpty()
    .withMessage("Rating is required")
    .isInt({
      min: 1,
      max: 5,
    })
    .withMessage(
      "Rating must be between 1 and 5"
    )
    .toInt(),

  body("title")
    .optional()
    .trim()
    .isLength({
      max: 100,
    })
    .withMessage(
      "Review title cannot exceed 100 characters"
    ),

  body("comment")
    .optional()
    .trim()
    .isLength({
      max: 1000,
    })
    .withMessage(
      "Review comment cannot exceed 1000 characters"
    ),
];

export const updateReviewValidation = [
  body("rating")
    .optional()
    .isInt({
      min: 1,
      max: 5,
    })
    .withMessage(
      "Rating must be between 1 and 5"
    )
    .toInt(),

  body("title")
    .optional()
    .trim()
    .isLength({
      max: 100,
    })
    .withMessage(
      "Review title cannot exceed 100 characters"
    ),

  body("comment")
    .optional()
    .trim()
    .isLength({
      max: 1000,
    })
    .withMessage(
      "Review comment cannot exceed 1000 characters"
    ),

  body().custom((value) => {
    if (
      value.rating === undefined &&
      value.title === undefined &&
      value.comment === undefined
    ) {
      throw new Error(
        "At least one review field is required"
      );
    }

    return true;
  }),
];