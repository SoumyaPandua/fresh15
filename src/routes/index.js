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
import refundRoutes from "../modules/refund/refund.routes.js";
import deliveryRoutes from "../modules/delivery/delivery.routes.js";
import reviewRoutes from "../modules/review/review.routes.js";
import notificationRoutes from "../modules/notification/notification.routes.js";
import customerRoutes from "../modules/customer/customer.routes.js";
import offerRoutes from "../modules/offer/offer.routes.js";
import bannerRoutes from "../modules/banner/banner.routes.js";
import dashboardRoutes from "../modules/dashboard/dashboard.routes.js";
import supportRoutes from "../modules/support/support.routes.js";
import settingRoutes from "../modules/setting/setting.routes.js";
import deliverySlotRoutes from "../modules/deliverySlot/deliverySlot.routes.js";
import productAlertRoutes from "../modules/productAlert/productAlert.routes.js";
import groceryListRoutes from "../modules/groceryList/groceryList.routes.js";
import loyaltyRoutes from "../modules/loyalty/loyalty.routes.js";
import partnerOpsRoutes from "../modules/partnerOps/partnerOps.routes.js";
import auditRoutes from "../modules/audit/audit.routes.js";
import aiRoutes from "../modules/ai/ai.routes.js";

const router = Router();

router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Backend Running",
    code: "OK",
    data: null,
    errors: [],
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
router.use("/refund", refundRoutes);
router.use("/delivery", deliveryRoutes);
router.use("/review", reviewRoutes);
router.use("/notification", notificationRoutes);
router.use("/customer", customerRoutes);
router.use("/offer", offerRoutes);
router.use("/banner", bannerRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/support", supportRoutes);
router.use("/setting", settingRoutes);
router.use("/delivery-slots", deliverySlotRoutes);
router.use("/product-alerts", productAlertRoutes);
router.use("/grocery-lists", groceryListRoutes);
router.use("/loyalty", loyaltyRoutes);
router.use("/partner-ops", partnerOpsRoutes);
router.use("/audit", auditRoutes);
router.use("/ai", aiRoutes);

export default router;
