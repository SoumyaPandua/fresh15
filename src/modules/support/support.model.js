import mongoose from "mongoose";

const supportSchema = new mongoose.Schema(
  {
    ticketNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    subject: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    attachments: [
      {
        url: String,
        publicId: String,
        fileName: String,
        mimeType: String,
        size: Number,
      },
    ],

    category: {
      type: String,
      enum: [
        "ORDER",
        "PAYMENT",
        "DELIVERY",
        "ACCOUNT",
        "PRODUCT",
        "REFUND",
        "OTHER",
      ],
      default: "OTHER",
    },

    priority: {
      type: String,
      enum: [
        "LOW",
        "MEDIUM",
        "HIGH",
        "URGENT",
      ],
      default: "LOW",
    },

    status: {
      type: String,
      enum: [
        "OPEN",
        "IN_PROGRESS",
        "RESOLVED",
        "CLOSED",
      ],
      default: "OPEN",
    },

    adminRemark: {
      type: String,
      default: "",
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

const Support = mongoose.model(
  "Support",
  supportSchema
);

export default Support;