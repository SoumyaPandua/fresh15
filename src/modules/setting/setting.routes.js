import express from "express";

import authMiddleware from "../../middleware/auth.middleware.js";
import validateRequest from "../../middleware/validateRequest.middleware.js";

import {
  getSetting,
  updateSetting,
} from "./setting.controller.js";

import {
  updateSettingValidation,
} from "./setting.validation.js";

const router = express.Router();

router.use(authMiddleware);

router.get(
  "/",
  getSetting
);

router.put(
  "/",
  authMiddleware,
  upload.single("logo"),
  updateSettingValidation,
  validateRequest,
  updateSetting
);

export default router;