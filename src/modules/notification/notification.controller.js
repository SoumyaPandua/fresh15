import sendResponse from "../../utils/sendResponse.js";
import { sendError } from "../../utils/errorResponse.js";

import {
  createNotificationService,
  deleteNotificationService,
  getMyNotificationsService,
  getNotificationByIdService,
  getUnreadNotificationCountService,
  markAllAsReadService,
  markAsReadService,
} from "./notification.service.js";

export const getMyNotifications = async (
  req,
  res
) => {
  try {
    const notifications =
      await getMyNotificationsService(
        req.user._id,
        req.query
      );

    return sendResponse(
      res,
      200,
      true,
      "Notifications fetched successfully",
      notifications
    );
  } catch (error) {
    return sendError(res, error);
  }
};

export const getNotificationById = async (
  req,
  res
) => {
  try {
    const notification =
      await getNotificationByIdService(
        req.params.id,
        req.user._id
      );

    return sendResponse(
      res,
      200,
      true,
      "Notification fetched successfully",
      notification
    );
  } catch (error) {
    return sendError(res, error);
  }
};

export const getUnreadNotificationCount =
  async (req, res) => {
    try {
      const count =
        await getUnreadNotificationCountService(
          req.user._id
        );

      return sendResponse(
        res,
        200,
        true,
        "Unread notification count fetched successfully",
        {
          count,
        }
      );
    } catch (error) {
    return sendError(res, error);
  }
  };

export const createNotification = async (
  req,
  res
) => {
  try {
    const notification =
      await createNotificationService(
        req.body,
        req.user._id
      );

    return sendResponse(
      res,
      201,
      true,
      "Notification created successfully",
      notification
    );
  } catch (error) {
    return sendError(res, error);
  }
};

export const markAsRead = async (
  req,
  res
) => {
  try {
    const notification =
      await markAsReadService(
        req.params.id,
        req.user._id
      );

    return sendResponse(
      res,
      200,
      true,
      "Notification marked as read",
      notification
    );
  } catch (error) {
    return sendError(res, error);
  }
};

export const markAllAsRead = async (
  req,
  res
) => {
  try {
    const result =
      await markAllAsReadService(
        req.user._id
      );

    return sendResponse(
      res,
      200,
      true,
      "All notifications marked as read",
      result
    );
  } catch (error) {
    return sendError(res, error);
  }
};

export const deleteNotification = async (
  req,
  res
) => {
  try {
    await deleteNotificationService(
      req.params.id,
      req.user._id
    );

    return sendResponse(
      res,
      200,
      true,
      "Notification deleted successfully"
    );
  } catch (error) {
    return sendError(res, error);
  }
};