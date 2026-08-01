import express from "express";

import authMiddleware from "../../middleware/auth.middleware.js";
import validateRequest from "../../middleware/validateRequest.middleware.js";

import {
  addToCartValidation,
  updateCartItemValidation,
} from "./cart.validation.js";

import {
  addToCart,
  clearCart,
  getMyCart,
  removeCartItem,
  updateCartItem,
} from "./cart.controller.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", getMyCart);

router.post(
  "/",
  addToCartValidation,
  validateRequest,
  addToCart
);

router.put(
  "/:productId",
  updateCartItemValidation,
  validateRequest,
  updateCartItem
);

router.delete("/:productId", removeCartItem);

router.delete("/clear", clearCart);

export default router;