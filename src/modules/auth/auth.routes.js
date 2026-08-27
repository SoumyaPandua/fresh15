import { Router } from "express";
import {
  register,
  verifyOtp,
  login,
  resendOtp,
  forgotPassword,
  resetPassword,
  me,
} from "./auth.controller.js";
import { registerValidation } from "./auth.validation.js";
import authMiddleware from "../../middleware/auth.middleware.js";
import { redisDualRateLimit } from "../../middleware/rateLimit.middleware.js";

const router = Router();
const emailKey = (req) => String(req.body?.email || "").trim().toLowerCase();

router.post("/register", redisDualRateLimit({ name: "register", max: 5, windowSeconds: 600, accountKeyFn: emailKey }), registerValidation, register);
router.post("/verify-otp", redisDualRateLimit({ name: "verify-otp", max: 10, windowSeconds: 600, accountKeyFn: emailKey }), verifyOtp);
router.post("/login", redisDualRateLimit({ name: "login", max: 10, windowSeconds: 60, accountKeyFn: emailKey }), login);
router.post("/resend-otp", redisDualRateLimit({ name: "resend-otp", max: 5, windowSeconds: 600, accountKeyFn: emailKey }), resendOtp);
router.post("/forgot-password", redisDualRateLimit({ name: "forgot-password", max: 5, windowSeconds: 600, accountKeyFn: emailKey }), forgotPassword);
router.post("/reset-password", redisDualRateLimit({ name: "reset-password", max: 5, windowSeconds: 600 }), resetPassword);
router.get("/me", authMiddleware, me);

export default router;
