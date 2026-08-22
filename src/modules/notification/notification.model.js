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
        "ORDER_CONFIRMED",
        "ORDER_CANCELLED",

        "PAYMENT_SUCCESS",
        "PAYMENT_FAILED",
        "REFUND_INITIATED",
        "REFUND_COMPLETED",

        "RIDER_ASSIGNED",
        "DELIVERY_ACCEPTED",
        "PICKED_UP",
        "OUT_FOR_DELIVERY",
        "DELIVERED",
        "DELIVERY_REJECTED",

        "REVIEW_CREATED",

        "BACK_IN_STOCK",
        "PRICE_DROP",
        "LOYALTY_REWARD",

        "PROMOTIONAL",
        "GENERAL",
      ],
      required: true,
      index: true,
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
      index: true,
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
      type: mongoose.Schema.Types.Mixed,
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

notificationSchema.index({
  userId: 1,
  isRead: 1,
  createdAt: -1,
});

const Notification = mongoose.model(
  "Notification",
  notificationSchema
);

export default Notification;