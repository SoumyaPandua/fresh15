import express from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import validateRequest from "../../middleware/validateRequest.middleware.js";
import authorize from "../../middleware/authorize.middleware.js";
import { uploadSingleImage } from "../../middleware/upload.middleware.js";
import { getSetting, updateSetting } from "./setting.controller.js";
import { updateSettingValidation } from "./setting.validation.js";

const router = express.Router();
router.use(authMiddleware);
router.get("/", getSetting);
router.put("/", authorize("ADMIN", "SUPER_ADMIN"), uploadSingleImage, updateSettingValidation, validateRequest, updateSetting);

export default router;
