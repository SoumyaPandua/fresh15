import express from "express";

import authMiddleware from "../../middleware/auth.middleware.js";
import validateRequest from "../../middleware/validateRequest.middleware.js";
import { uploadSingleImage } from "../../middleware/upload.middleware.js";
import authorize from "../../middleware/authorize.middleware.js";

import {
  createCategoryValidation,
  updateCategoryValidation,
} from "./category.validation.js";

import {
  createCategory,
  deleteCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  updateCategoryStatus,
} from "./category.controller.js";

const router = express.Router();

router.get("/", getAllCategories);
router.get("/:id", getCategoryById);

router.post(
  "/",
  authMiddleware,
  authorize("ADMIN", "SUPER_ADMIN"),
  uploadSingleImage,
  createCategoryValidation,
  validateRequest,
  createCategory
);

router.put(
  "/:id",
  authMiddleware,
  authorize("ADMIN", "SUPER_ADMIN"),
  uploadSingleImage,
  updateCategoryValidation,
  validateRequest,
  updateCategory
);

router.patch(
  "/:id/status",
  authMiddleware,
  authorize("ADMIN", "SUPER_ADMIN"),
  updateCategoryStatus
);

router.delete(
  "/:id",
  authMiddleware,
  authorize("ADMIN", "SUPER_ADMIN"),
  deleteCategory
);

export default router;