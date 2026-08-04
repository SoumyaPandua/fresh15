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

/*
 * Public route
 * Customers/guests can view reviews without authentication.
 */
router.get(
  "/product/:productId",
  getProductReviews
);

/*
 * Authenticated routes
 */
router.get(
  "/my-reviews",
  authMiddleware,
  getMyReviews
);

router.get(
  "/:id",
  authMiddleware,
  getReviewById
);

router.post(
  "/",
  authMiddleware,
  createReviewValidation,
  validateRequest,
  createReview
);

router.put(
  "/:id",
  authMiddleware,
  updateReviewValidation,
  validateRequest,
  updateReview
);

router.delete(
  "/:id",
  authMiddleware,
  deleteReview
);

export default router;