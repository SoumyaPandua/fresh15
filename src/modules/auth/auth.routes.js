import { Router } from "express";
import {
    register,
    verifyOtp,
    login,
    resendOtp,
    forgotPassword,
    resetPassword,
    me
} from "./auth.controller.js";

import { registerValidation } from "./auth.validation.js";
import authMiddleware from "../../middleware/auth.middleware.js";

const router = Router();

router.post("/register", registerValidation, register);
router.post("/verify-otp", verifyOtp);
router.post("/login", login);
router.post("/resend-otp", resendOtp);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/me", authMiddleware, me);

export default router;