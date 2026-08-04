import express from "express";

import authMiddleware from "../../middleware/auth.middleware.js";
import validateRequest from "../../middleware/validateRequest.middleware.js";
import authorize from "../../middleware/authorize.middleware.js";

import {
  createNotificationValidation,
} from "./notification.validation.js";

import {
  createNotification,
  deleteNotification,
  getMyNotifications,
  getNotificationById,
  getUnreadNotificationCount,
  markAllAsRead,
  markAsRead,
} from "./notification.controller.js";

const router = express.Router();

router.use(authMiddleware);

router.get(
  "/",
  getMyNotifications
);

router.get(
  "/unread-count",
  getUnreadNotificationCount
);

router.patch(
  "/read-all",
  markAllAsRead
);

router.get(
  "/:id",
  getNotificationById
);

router.post(
  "/",
  authorize("ADMIN", "SUPER_ADMIN"),
  createNotificationValidation,
  validateRequest,
  createNotification
);

router.patch(
  "/:id/read",
  markAsRead
);

router.delete(
  "/:id",
  deleteNotification
);

export default router;