import { Router } from "express";

import authRoutes from "../modules/auth/auth.routes.js";
import profileRoutes from "../modules/profile/profile.routes.js";
import categoryRoutes from "../modules/category/category.routes.js";
import productRoutes from "../modules/product/product.routes.js";
import inventoryRoutes from "../modules/inventory/inventory.routes.js";
import addressRoutes from "../modules/address/address.routes.js";

const router = Router();

router.get("/health", (req, res) => {
    res.json({
        success: true,
        message: "Backend Running"
    });
});

router.use("/auth", authRoutes);
router.use("/profile", profileRoutes);
router.use("/category", categoryRoutes);
router.use("/product", productRoutes);
router.use("/inventory", inventoryRoutes);
router.use("/address", addressRoutes);

export default router;