import express from "express";

import {
  changePassword,
  getMyProfile,
  updateAvatar,
  updateMyProfile,
} from "./profile.controller.js";

import authMiddleware from "../../middleware/auth.middleware.js";
import validateRequest from "../../middleware/validateRequest.middleware.js";
import { uploadSingleImage } from "../../middleware/upload.middleware.js";

import {
  changePasswordValidation,
  updateAvatarValidation,
  updateProfileValidation,
} from "./profile.validation.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", getMyProfile);

router.put(
  "/",
  updateProfileValidation,
  validateRequest,
  updateMyProfile
);

router.patch(
    "/avatar",
    authMiddleware,
    uploadSingleImage,
    updateAvatar
);

router.patch(
  "/password",
  changePasswordValidation,
  validateRequest,
  changePassword
);

export default router;