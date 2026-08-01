import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes.js";
// import cartRoutes from "./modules/cart/cart.routes.js";


const router = Router();

router.get("/health", (req, res) => {
    res.json({
        success: true,
        message: "Backend Running"
    });
});

router.use("/auth", authRoutes);
// app.use("/api/cart", cartRoutes);

export default router;