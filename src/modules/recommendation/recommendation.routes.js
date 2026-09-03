import express from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import authorize from "../../middleware/authorize.middleware.js";
import { redisActionRateLimit } from "../../middleware/rateLimit.middleware.js";
import {
  recommendations,
  smartBasket,
  optimizedOffers,
  dashboard,
  recordEvents,
  adminAnalytics,
} from "./recommendation.controller.js";

const router = express.Router();

router.post("/events", authMiddleware, authorize("CUSTOMER"), redisActionRateLimit({ name: "recommendation-events", max: 60, windowSeconds: 60 }), recordEvents);
router.get("/admin/analytics", authMiddleware, authorize("ADMIN", "SUPER_ADMIN"), adminAnalytics);

router.use(authMiddleware, authorize("CUSTOMER"));
router.get("/me", recommendations);
router.get("/smart-basket", smartBasket);
router.get("/offers", optimizedOffers);
router.get("/dashboard", redisActionRateLimit({ name: "recommendation-dashboard", max: 30, windowSeconds: 60 }), dashboard);

export default router;
