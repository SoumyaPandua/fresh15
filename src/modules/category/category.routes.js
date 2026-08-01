import express from "express";

import authMiddleware from "../../middleware/auth.middleware.js";
import validateRequest from "../../middleware/validateRequest.middleware.js";
import { uploadSingleImage } from "../../middleware/upload.middleware.js";

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

router.use(authMiddleware);

router.get("/", getAllCategories);

router.get("/:id", getCategoryById);

router.post(
  "/",
  uploadSingleImage,
  createCategoryValidation,
  validateRequest,
  createCategory
);

router.put(
  "/:id",
  uploadSingleImage,
  updateCategoryValidation,
  validateRequest,
  updateCategory
);

router.patch("/:id/status", updateCategoryStatus);

router.delete("/:id", deleteCategory);

export default router;