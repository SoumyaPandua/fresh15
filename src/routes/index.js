import { Router } from "express";

import authRoutes from "../modules/auth/auth.routes.js";
import profileRoutes from "../modules/profile/profile.routes.js";

const router = Router();

router.get("/health", (req, res) => {
    res.json({
        success: true,
        message: "Backend Running"
    });
});

router.use("/auth", authRoutes);
router.use("/profile", profileRoutes);

export default router;