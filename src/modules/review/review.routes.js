import express from "express";

import authMiddleware from "../../middleware/auth.middleware.js";
import validateRequest from "../../middleware/validateRequest.middleware.js";

import {
  createReviewValidation,
  updateReviewValidation,
} from "./review.validation.js";

import {
  createReview,
  deleteReview,
  getMyReviews,
  getProductReviews,
  getReviewById,
  updateReview,
} from "./review.controller.js";

const router = express.Router();

router.use(authMiddleware);

router.get(
  "/product/:productId",
  getProductReviews
);

router.get(
  "/my-reviews",
  getMyReviews
);

router.get(
  "/:id",
  getReviewById
);

router.post(
  "/",
  createReviewValidation,
  validateRequest,
  createReview
);

router.put(
  "/:id",
  updateReviewValidation,
  validateRequest,
  updateReview
);

router.delete(
  "/:id",
  deleteReview
);

export default router;