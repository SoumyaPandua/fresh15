import { body } from "express-validator";

export const addWishlistValidation = [
  body("productId")
    .notEmpty()
    .withMessage("Product is required")
    .isMongoId()
    .withMessage("Invalid product"),
];