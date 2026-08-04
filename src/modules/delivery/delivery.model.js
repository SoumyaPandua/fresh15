import mongoose from "mongoose";

const deliverySchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      unique: true,
    },

    riderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    status: {
      type: String,
      enum: [
        "PENDING",
        "ASSIGNED",
        "ACCEPTED",
        "PICKED_UP",
        "OUT_FOR_DELIVERY",
        "DELIVERED",
        "REJECTED",
        "CANCELLED",
      ],
      default: "PENDING",
    },

    riderStatus: {
      type: String,
      enum: [
        "ONLINE",
        "OFFLINE",
        "BUSY",
      ],
      default: "OFFLINE",
    },

    assignedAt: {
      type: Date,
      default: null,
    },

    acceptedAt: {
      type: Date,
      default: null,
    },

    pickedUpAt: {
      type: Date,
      default: null,
    },

    deliveredAt: {
      type: Date,
      default: null,
    },

    rejectedAt: {
      type: Date,
      default: null,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    estimatedDeliveryTime: {
      type: Date,
      default: null,
    },

    deliveryOtp: {
      type: String,
      default: null,
    },

    deliveryOtpVerified: {
      type: Boolean,
      default: false,
    },

    deliveryCharge: {
      type: Number,
      default: 0,
    },

    earning: {
      type: Number,
      default: 0,
    },

    notes: {
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

const Delivery = mongoose.model(
  "Delivery",
  deliverySchema
);

export default Delivery;