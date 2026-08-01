import express from "express";

import authMiddleware from "../../middleware/auth.middleware.js";
import validateRequest from "../../middleware/validateRequest.middleware.js";
import { uploadMultipleImages } from "../../middleware/upload.middleware.js";

import {
  createProductValidation,
  updateProductValidation,
} from "./product.validation.js";

import {
  createProduct,
  deleteProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  updateProductStatus,
} from "./product.controller.js";

const router = express.Router();

router.use(authMiddleware);

/**
 * GET /api/product
 * Query Params:
 * search
 * categoryId
 * isFeatured
 * isActive
 */
router.get("/", getAllProducts);

/**
 * GET /api/product/:id
 */
router.get("/:id", getProductById);

/**
 * POST /api/product
 * multipart/form-data
 */
router.post(
  "/",
  uploadMultipleImages,
  createProductValidation,
  validateRequest,
  createProduct
);

/**
 * PUT /api/product/:id
 * multipart/form-data
 */
router.put(
  "/:id",
  uploadMultipleImages,
  updateProductValidation,
  validateRequest,
  updateProduct
);

/**
 * PATCH /api/product/:id/status
 */
router.patch("/:id/status", updateProductStatus);

/**
 * DELETE /api/product/:id
 */
router.delete("/:id", deleteProduct);

export default router;