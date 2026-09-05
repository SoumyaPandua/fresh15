import Notification from "./notification.model.js";
import User from "../user/user.model.js";
import sendEmail from "../../utils/sendEmail.js";
import { parsePagination, buildPagination } from "../../utils/pagination.js";
import { enqueueRealtimeEvent } from "../outbox/outbox.service.js";

const sendNotificationEmail = async (
  user,
  title,
  message
) => {
  if (!user.email) {
    throw new Error(
      "User does not have an email address"
    );
  }

  await sendEmail(
    user.email,
    title,
    `
      <div style="font-family:Arial,sans-serif">
        <h2>${title}</h2>
        <p>${message}</p>
      </div>
    `
  );
};

export const createNotificationService =
  async (body, createdBy) => {
    const user = await User.findById(
      body.userId
    );

    if (!user) {
      throw new Error("User not found");
    }

    const channel =
      body.channel || "IN_APP";

    const notification =
      await Notification.create({
        userId: body.userId,
        title: body.title,
        message: body.message,
        type: body.type,
        channel,
        metadata:
          body.metadata || {},
        createdBy,
      });

    if (channel === "IN_APP") {
      void enqueueRealtimeEvent(
        `notification:${body.userId}:${notification._id}`,
        "customer:notification",
        {
          _id: String(notification._id),
          title: notification.title,
          message: notification.message,
          type: notification.type,
          metadata: notification.metadata || {},
          createdAt: notification.createdAt,
        },
        "customer",
        body.userId,
      ).catch((error) => {
        console.error(
          "Customer notification realtime enqueue failed:",
          error.message,
        );
      });
    }

    if (channel === "EMAIL") {
      await sendNotificationEmail(
        user,
        body.title,
        body.message
      );
    }

    return notification;
  };

export const getMyNotificationsService = async (userId, query = {}) => {
  const pagination = parsePagination(query);
  const filter = { userId };
  const base = Notification.find(filter).sort({ createdAt: -1 });
  if (!pagination.hasPagination) return await base;
  const [items, total] = await Promise.all([base.skip(pagination.skip).limit(pagination.limit), Notification.countDocuments(filter)]);
  return { items, pagination: buildPagination({ page: pagination.page, limit: pagination.limit, total }) };
};

export const getNotificationByIdService =
  async (id, userId) => {
    const notification =
      await Notification.findOne({
        _id: id,
        userId,
      });

    if (!notification) {
      throw new Error(
        "Notification not found"
      );
    }

    return notification;
  };

export const getUnreadNotificationCountService =
  async (userId) => {
    return await Notification.countDocuments({
      userId,
      isRead: false,
    });
  };

export const markAsReadService =
  async (id, userId) => {
    const notification =
      await Notification.findOne({
        _id: id,
        userId,
      });

    if (!notification) {
      throw new Error(
        "Notification not found"
      );
    }

    if (!notification.isRead) {
      notification.isRead = true;
      notification.readAt =
        new Date();
      notification.updatedBy =
        userId;

      await notification.save();
    }

    return notification;
  };

export const markAllAsReadService =
  async (userId) => {
    const now = new Date();

    const result =
      await Notification.updateMany(
        {
          userId,
          isRead: false,
        },
        {
          $set: {
            isRead: true,
            readAt: now,
            updatedBy: userId,
          },
        }
      );

    return {
      modifiedCount:
        result.modifiedCount || 0,
    };
  };

export const deleteNotificationService =
  async (id, userId) => {
    const notification =
      await Notification.findOne({
        _id: id,
        userId,
      });

    if (!notification) {
      throw new Error(
        "Notification not found"
      );
    }

    await notification.deleteOne();

    return;
  };

export const sendNotificationService =
  async ({
    userId,
    title,
    message,
    type,
    channel = "IN_APP",
    metadata = {},
    createdBy,
  }) => {
    return await createNotificationService(
      {
        userId,
        title,
        message,
        type,
        channel,
        metadata,
      },
      createdBy || userId
    );
  };
