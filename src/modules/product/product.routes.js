import express from "express";

import authMiddleware from "../../middleware/auth.middleware.js";
import validateRequest from "../../middleware/validateRequest.middleware.js";
import { uploadMultipleImages } from "../../middleware/upload.middleware.js";
import authorize from "../../middleware/authorize.middleware.js";

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

router.get("/", getAllProducts);

router.get("/:id", getProductById);

router.post(
  "/",
  authMiddleware,
  authorize("ADMIN", "SUPER_ADMIN"),
  uploadMultipleImages,
  createProductValidation,
  validateRequest,
  createProduct
);

router.put(
  "/:id",
  authMiddleware,
  authorize("ADMIN", "SUPER_ADMIN"),
  uploadMultipleImages,
  updateProductValidation,
  validateRequest,
  updateProduct
);

router.patch("/:id/status", authMiddleware, authorize("ADMIN", "SUPER_ADMIN"), updateProductStatus);

router.delete("/:id", authMiddleware, authorize("ADMIN", "SUPER_ADMIN"), deleteProduct);

export default router;