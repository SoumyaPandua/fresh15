import express from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import authorize from "../../middleware/authorize.middleware.js";
import validateRequest from "../../middleware/validateRequest.middleware.js";
import { uploadSingleImage } from "../../middleware/upload.middleware.js";
import {
  createBannerValidation,
  updateBannerStatusValidation,
  updateBannerValidation,
} from "./banner.validation.js";
import {
  createBanner,
  deleteBanner,
  getActiveBanners,
  getAllBanners,
  updateBanner,
  updateBannerStatus,
} from "./banner.controller.js";

const router = express.Router();

router.get("/active", getActiveBanners);

router.use(authMiddleware);
router.use(authorize("ADMIN", "SUPER_ADMIN"));

router.get("/", getAllBanners);
router.post("/", uploadSingleImage, createBannerValidation, validateRequest, createBanner);
router.put("/:id", uploadSingleImage, updateBannerValidation, validateRequest, updateBanner);
router.patch("/:id/status", updateBannerStatusValidation, validateRequest, updateBannerStatus);
router.delete("/:id", deleteBanner);

export default router;
