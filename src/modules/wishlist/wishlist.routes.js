import express from "express";

import authMiddleware from "../../middleware/auth.middleware.js";
import validateRequest from "../../middleware/validateRequest.middleware.js";

import { addWishlistValidation } from "./wishlist.validation.js";

import {
  addWishlist,
  getMyWishlist,
  removeWishlist,
} from "./wishlist.controller.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", getMyWishlist);

router.post(
  "/",
  addWishlistValidation,
  validateRequest,
  addWishlist
);

router.delete("/:productId", removeWishlist);

export default router;