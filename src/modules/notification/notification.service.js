import Notification from "./notification.model.js";
import User from "../user/user.model.js";
import sendEmail from "../../utils/sendEmail.js";

export const createNotificationService =
  async (body, createdBy) => {
    const user = await User.findById(
      body.userId
    );

    if (!user) {
      throw new Error("User not found");
    }

    const notification =
      await Notification.create({
        userId: body.userId,
        title: body.title,
        message: body.message,
        type: body.type,
        channel:
          body.channel || "IN_APP",
        metadata:
          body.metadata || {},
        createdBy,
      });

    if (
      body.channel === "EMAIL" ||
      body.channel === undefined
    ) {
      await sendEmail(
        user.email,
        body.title,
        `
    <div style="font-family:Arial,sans-serif">
      <h2>${body.title}</h2>
      <p>${body.message}</p>
    </div>
  `
      );
    }

    return notification;
  };

export const getMyNotificationsService =
  async (userId) => {
    return await Notification.find({
      userId,
    }).sort({
      createdAt: -1,
    });
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

    notification.isRead = true;
    notification.readAt = new Date();
    notification.updatedBy = userId;

    await notification.save();

    return notification;
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
      createdBy
    );
  };