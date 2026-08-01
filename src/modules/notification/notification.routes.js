import express from "express";

import authMiddleware from "../../middleware/auth.middleware.js";
import validateRequest from "../../middleware/validateRequest.middleware.js";

import {
  createNotificationValidation,
} from "./notification.validation.js";

import {
  createNotification,
  deleteNotification,
  getMyNotifications,
  getNotificationById,
  markAsRead,
} from "./notification.controller.js";

const router = express.Router();

router.use(authMiddleware);

router.get(
  "/",
  getMyNotifications
);

router.get(
  "/:id",
  getNotificationById
);

router.post(
  "/",
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