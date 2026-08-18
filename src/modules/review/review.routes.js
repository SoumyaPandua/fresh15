import express from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import validateRequest from "../../middleware/validateRequest.middleware.js";
import authorize from "../../middleware/authorize.middleware.js";
import { createReviewValidation, updateReviewValidation, adminReviewValidation } from "./review.validation.js";
import {
  createReview, deleteReview, getAllReviews, getMyReviews, getProductReviews, getReviewById,
  updateReview, adminUpdateReview, adminDeleteReview,
} from "./review.controller.js";

const router = express.Router();

router.get("/product/:productId", getProductReviews);
router.get("/my-reviews", authMiddleware, authorize("CUSTOMER"), getMyReviews);
router.get("/all", authMiddleware, authorize("ADMIN", "SUPER_ADMIN"), getAllReviews);
router.get("/:id", authMiddleware, getReviewById);
router.post("/", authMiddleware, authorize("CUSTOMER"), createReviewValidation, validateRequest, createReview);
router.put("/:id", authMiddleware, authorize("CUSTOMER"), updateReviewValidation, validateRequest, updateReview);
router.delete("/:id", authMiddleware, authorize("CUSTOMER"), deleteReview);
router.put("/admin/:id", authMiddleware, authorize("ADMIN", "SUPER_ADMIN"), adminReviewValidation, validateRequest, adminUpdateReview);
router.delete("/admin/:id", authMiddleware, authorize("ADMIN", "SUPER_ADMIN"), adminDeleteReview);

export default router;
