import express from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import validateRequest from "../../middleware/validateRequest.middleware.js";
import { uploadSingleImage, validateUploadedImages } from "../../middleware/upload.middleware.js";
import authorize from "../../middleware/authorize.middleware.js";
import { createCategoryValidation, updateCategoryValidation } from "./category.validation.js";
import { createCategory, deleteCategory, getAllCategories, getCategoryById, updateCategory, updateCategoryStatus } from "./category.controller.js";
import { redisActionRateLimit } from "../../middleware/rateLimit.middleware.js";

const router = express.Router();

router.get("/", getAllCategories);
router.get("/:id", getCategoryById);

router.post(
  "/",
  authMiddleware,
  authorize("ADMIN", "SUPER_ADMIN"),
  redisActionRateLimit({ name: "category-create", max: 30, windowSeconds: 60 }),
  uploadSingleImage,
  validateUploadedImages,
  createCategoryValidation,
  validateRequest,
  createCategory,
);

router.put(
  "/:id",
  authMiddleware,
  authorize("ADMIN", "SUPER_ADMIN"),
  redisActionRateLimit({ name: "category-update", max: 60, windowSeconds: 60 }),
  uploadSingleImage,
  validateUploadedImages,
  updateCategoryValidation,
  validateRequest,
  updateCategory,
);

router.patch("/:id/status", authMiddleware, authorize("ADMIN", "SUPER_ADMIN"), redisActionRateLimit({ name: "category-status", max: 60, windowSeconds: 60 }), updateCategoryStatus);
router.delete("/:id", authMiddleware, authorize("ADMIN", "SUPER_ADMIN"), redisActionRateLimit({ name: "category-delete", max: 30, windowSeconds: 60 }), deleteCategory);

export default router;
