import mongoose from "mongoose";

const locationSchema = new mongoose.Schema(
  {
    latitude: {
      type: Number,
      min: -90,
      max: 90,
      default: null,
    },
    longitude: {
      type: Number,
      min: -180,
      max: 180,
      default: null,
    },
    accuracy: {
      type: Number,
      min: 0,
      default: null,
    },
    speed: {
      type: Number,
      min: 0,
      default: null,
    },
    heading: {
      type: Number,
      min: 0,
      max: 360,
      default: null,
    },
    updatedAt: {
      type: Date,
      default: null,
    },
  },
  {
    _id: false,
  }
);

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
        "FAILED",
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

    currentLocation: {
      type: locationSchema,
      default: null,
    },

    // Plain OTP is hidden from normal queries and only returned through the
    // customer-owned OTP endpoint. Never expose it to riders/admins.
    deliveryOtp: {
      type: String,
      default: null,
      select: false,
    },

    deliveryOtpExpiresAt: {
      type: Date,
      default: null,
    },

    deliveryOtpAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },

    deliveryOtpVerified: {
      type: Boolean,
      default: false,
    },

    deliveryOtpVerifiedAt: {
      type: Date,
      default: null,
    },

    customerConfirmedAt: {
      type: Date,
      default: null,
    },

    proofOfDelivery: {
      photoUrl: {
        type: String,
        default: null,
      },
      signatureUrl: {
        type: String,
        default: null,
      },
      uploadedAt: {
        type: Date,
        default: null,
      },
      uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
    },

    failedDelivery: {
      reason: {
        type: String,
        default: null,
      },
      note: {
        type: String,
        default: "",
      },
      failedAt: {
        type: Date,
        default: null,
      },
      failedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
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
