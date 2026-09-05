import express from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import authorize from "../../middleware/authorize.middleware.js";
import { createDeliveryRating, getDeliveryRating } from "./deliveryRating.controller.js";

const router = express.Router();
router.use(authMiddleware, authorize("CUSTOMER"));
router.get("/:orderId", getDeliveryRating);
router.post("/:orderId", createDeliveryRating);
export default router;
