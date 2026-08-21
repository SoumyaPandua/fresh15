import express from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import validateRequest from "../../middleware/validateRequest.middleware.js";
import authorize from "../../middleware/authorize.middleware.js";
import { createOrderValidation, updateOrderStatusValidation, reorderValidation } from "./order.validation.js";
import { createOrder, getMyOrders, getOrderById, updateOrderStatus, getAllOrders, cancelMyOrder, archiveOrder, getReorderList, reorderToCart } from "./order.controller.js";

const router = express.Router();
router.use(authMiddleware);

router.get("/reorder-list", authorize("CUSTOMER"), getReorderList);
router.post("/reorder", authorize("CUSTOMER"), reorderValidation, validateRequest, reorderToCart);
router.get("/", getMyOrders);
router.get("/admin/all", authorize("ADMIN", "SUPER_ADMIN"), getAllOrders);
router.get("/:id", getOrderById);
router.post("/", createOrderValidation, validateRequest, createOrder);
router.patch("/:id/status", authorize("ADMIN", "SUPER_ADMIN"), updateOrderStatusValidation, validateRequest, updateOrderStatus);
router.patch("/:id/cancel", authorize("CUSTOMER"), cancelMyOrder);
router.delete("/:id", authorize("ADMIN", "SUPER_ADMIN"), archiveOrder);

export default router;
