import express from "express";

import authMiddleware from "../../middleware/auth.middleware.js";
import validateRequest from "../../middleware/validateRequest.middleware.js";

import {
  addToCartValidation,
  updateCartItemValidation,
  updateCartItemSubstitutionValidation,
} from "./cart.validation.js";

import {
  addToCart,
  clearCart,
  getMyCart,
  removeCartItem,
  updateCartItem,
  updateCartItemSubstitution,
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

router.patch(
  "/:productId/substitution",
  updateCartItemSubstitutionValidation,
  validateRequest,
  updateCartItemSubstitution
);

router.delete("/clear", clearCart);

router.delete("/:productId", removeCartItem);

export default router;