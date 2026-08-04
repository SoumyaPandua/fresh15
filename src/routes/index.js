import { Router } from "express";

import authRoutes from "../modules/auth/auth.routes.js";
import profileRoutes from "../modules/profile/profile.routes.js";
import categoryRoutes from "../modules/category/category.routes.js";
import productRoutes from "../modules/product/product.routes.js";
import inventoryRoutes from "../modules/inventory/inventory.routes.js";
import addressRoutes from "../modules/address/address.routes.js";
import cartRoutes from "../modules/cart/cart.routes.js";
import wishlistRoutes from "../modules/wishlist/wishlist.routes.js";
import couponRoutes from "../modules/coupon/coupon.routes.js";
import orderRoutes from "../modules/order/order.routes.js";
import paymentRoutes from "../modules/payment/payment.routes.js";
import deliveryRoutes from "../modules/delivery/delivery.routes.js";
import reviewRoutes from "../modules/review/review.routes.js";
import notificationRoutes from "../modules/notification/notification.routes.js";

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
router.use("/cart", cartRoutes);
router.use("/wishlist", wishlistRoutes);
router.use("/coupon", couponRoutes);
router.use("/order", orderRoutes);
router.use("/payment", paymentRoutes);
router.use("/delivery", deliveryRoutes);
router.use("/review", reviewRoutes);
// router.use("/notification", notificationRoutes);

export default router;