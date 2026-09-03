import express from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import authorize from "../../middleware/authorize.middleware.js";
import validateRequest from "../../middleware/validateRequest.middleware.js";
import { uploadSingleImage, validateUploadedImages } from "../../middleware/upload.middleware.js";
import { createBannerValidation, updateBannerStatusValidation, updateBannerValidation } from "./banner.validation.js";
import { createBanner, deleteBanner, getActiveBanners, getAllBanners, updateBanner, updateBannerStatus } from "./banner.controller.js";
import { redisActionRateLimit } from "../../middleware/rateLimit.middleware.js";

const router = express.Router();

router.get("/active", getActiveBanners);
router.use(authMiddleware);
router.use(authorize("ADMIN", "SUPER_ADMIN"));

router.get("/", getAllBanners);
router.post("/", redisActionRateLimit({ name: "banner-create", max: 30, windowSeconds: 60 }), uploadSingleImage, validateUploadedImages, createBannerValidation, validateRequest, createBanner);
router.put("/:id", redisActionRateLimit({ name: "banner-update", max: 60, windowSeconds: 60 }), uploadSingleImage, validateUploadedImages, updateBannerValidation, validateRequest, updateBanner);
router.patch("/:id/status", redisActionRateLimit({ name: "banner-status", max: 60, windowSeconds: 60 }), updateBannerStatusValidation, validateRequest, updateBannerStatus);
router.delete("/:id", redisActionRateLimit({ name: "banner-delete", max: 30, windowSeconds: 60 }), deleteBanner);

export default router;
