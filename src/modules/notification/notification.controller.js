import sendResponse from "../../utils/sendResponse.js";

import {
  createNotificationService,
  deleteNotificationService,
 getMyNotificationsService,
  getNotificationByIdService,
  markAsReadService,
} from "./notification.service.js";

export const createNotification = async (
  req,
  res
) => {
  try {
    const data =
      await createNotificationService(
        req.body,
        req.user._id
      );

    return sendResponse(
      res,
      201,
      true,
      "Notification created successfully",
      data
    );
  } catch (error) {
    return sendResponse(
      res,
      400,
      false,
      error.message
    );
  }
};

export const getMyNotifications =
  async (req, res) => {
    try {
      const data =
        await getMyNotificationsService(
          req.user._id
        );

      return sendResponse(
        res,
        200,
        true,
        "Notifications fetched successfully",
        data
      );
    } catch (error) {
      return sendResponse(
        res,
        400,
        false,
        error.message
      );
    }
  };

export const getNotificationById =
  async (req, res) => {
    try {
      const data =
        await getNotificationByIdService(
          req.params.id,
          req.user._id
        );

      return sendResponse(
        res,
        200,
        true,
        "Notification fetched successfully",
        data
      );
    } catch (error) {
      return sendResponse(
        res,
        400,
        false,
        error.message
      );
    }
  };

export const markAsRead = async (
  req,
  res
) => {
  try {
    const data =
      await markAsReadService(
        req.params.id,
        req.user._id
      );

    return sendResponse(
      res,
      200,
      true,
      "Notification marked as read",
      data
    );
  } catch (error) {
    return sendResponse(
      res,
      400,
      false,
      error.message
    );
  }
};

export const deleteNotification =
  async (req, res) => {
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
      return sendResponse(
        res,
        400,
        false,
        error.message
      );
    }
  };