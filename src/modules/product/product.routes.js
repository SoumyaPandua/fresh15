import express from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import validateRequest from "../../middleware/validateRequest.middleware.js";
import { uploadMultipleImages, validateUploadedImages } from "../../middleware/upload.middleware.js";
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
import { redisActionRateLimit } from "../../middleware/rateLimit.middleware.js";

const router = express.Router();

router.get("/", getAllProducts);
router.get("/:id", getProductById);

router.post(
  "/",
  authMiddleware,
  authorize("ADMIN", "SUPER_ADMIN"),
  redisActionRateLimit({ name: "product-create", max: 30, windowSeconds: 60 }),
  uploadMultipleImages,
  validateUploadedImages,
  createProductValidation,
  validateRequest,
  createProduct,
);

router.put(
  "/:id",
  authMiddleware,
  authorize("ADMIN", "SUPER_ADMIN"),
  redisActionRateLimit({ name: "product-update", max: 60, windowSeconds: 60 }),
  uploadMultipleImages,
  validateUploadedImages,
  updateProductValidation,
  validateRequest,
  updateProduct,
);

router.patch("/:id/status", authMiddleware, authorize("ADMIN", "SUPER_ADMIN"), redisActionRateLimit({ name: "product-status", max: 60, windowSeconds: 60 }), updateProductStatus);
router.delete("/:id", authMiddleware, authorize("ADMIN", "SUPER_ADMIN"), redisActionRateLimit({ name: "product-delete", max: 30, windowSeconds: 60 }), deleteProduct);

export default router;
