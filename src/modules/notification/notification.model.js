import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      enum: [
        "WELCOME",
        "OTP",
        "PASSWORD_RESET",
        "ORDER_PLACED",
        "PAYMENT_SUCCESS",
        "PAYMENT_FAILED",
        "ORDER_CONFIRMED",
        "RIDER_ASSIGNED",
        "OUT_FOR_DELIVERY",
        "DELIVERED",
        "CANCELLED",
        "PROMOTIONAL",
      ],
      required: true,
    },

    channel: {
      type: String,
      enum: [
        "IN_APP",
        "EMAIL",
        "SMS",
        "PUSH",
      ],
      default: "IN_APP",
    },

    isRead: {
      type: Boolean,
      default: false,
    },

    sentAt: {
      type: Date,
      default: Date.now,
    },

    readAt: {
      type: Date,
      default: null,
    },

    metadata: {
      type: Object,
      default: {},
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Notification = mongoose.model(
  "Notification",
  notificationSchema
);

export default Notification;