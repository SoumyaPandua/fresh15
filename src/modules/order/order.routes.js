import express from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import validateRequest from "../../middleware/validateRequest.middleware.js";
import authorize from "../../middleware/authorize.middleware.js";
import { redisActionRateLimit } from "../../middleware/rateLimit.middleware.js";
import { createOrderValidation, updateOrderStatusValidation, reorderValidation } from "./order.validation.js";
import { createOrder, getMyOrders, getOrderById, updateOrderStatus, getAllOrders, cancelMyOrder, archiveOrder, getReorderList, reorderToCart } from "./order.controller.js";

const router = express.Router();
router.use(authMiddleware);

router.get("/reorder-list", authorize("CUSTOMER"), getReorderList);
router.post("/reorder", authorize("CUSTOMER"), redisActionRateLimit({ name: "reorder", max: 10, windowSeconds: 60 }), reorderValidation, validateRequest, reorderToCart);
router.get("/", getMyOrders);
router.get("/admin/all", authorize("ADMIN", "SUPER_ADMIN"), getAllOrders);
router.get("/:id", getOrderById);
router.post("/", redisActionRateLimit({ name: "order-create", max: 5, windowSeconds: 60 }), createOrderValidation, validateRequest, createOrder);
router.patch("/:id/status", authorize("ADMIN", "SUPER_ADMIN"), redisActionRateLimit({ name: "order-status", max: 60, windowSeconds: 60 }), updateOrderStatusValidation, validateRequest, updateOrderStatus);
router.patch("/:id/cancel", authorize("CUSTOMER"), redisActionRateLimit({ name: "order-cancel", max: 10, windowSeconds: 60 }), cancelMyOrder);
router.delete("/:id", authorize("ADMIN", "SUPER_ADMIN"), redisActionRateLimit({ name: "order-archive", max: 30, windowSeconds: 60 }), archiveOrder);

export default router;
