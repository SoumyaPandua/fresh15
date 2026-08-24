import mongoose from "mongoose";

const refundSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    currency: {
      type: String,
      default: "INR",
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    statusHistory: [
      {
        _id: false,
        status: { type: String, required: true },
        at: { type: Date, default: Date.now },
      },
    ],
    status: {
      type: String,
      enum: [
        "REQUESTED",
        "APPROVED",
        "PROCESSING",
        "PROCESSED",
        "FAILED",
        "REJECTED",
        "MANUAL_REQUIRED",
        "REVERSED",
      ],
      default: "REQUESTED",
      index: true,
    },
    razorpayRefundId: {
      type: String,
      default: null,
      index: true,
    },
    gatewayResponse: {
      type: Object,
      default: {},
    },
    rejectionReason: {
      type: String,
      default: "",
      maxlength: 500,
    },
    manualReference: {
      type: String,
      default: "",
      maxlength: 200,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    processedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

refundSchema.pre("save", function (next) {
  if (this.isNew) {
    if (!this.statusHistory?.length) {
      this.statusHistory = [{ status: this.status, at: new Date() }];
    }
  } else if (this.isModified("status")) {
    const history = this.statusHistory || [];
    const last = history[history.length - 1];
    if (!last || last.status !== this.status) {
      history.push({ status: this.status, at: new Date() });
    }
    this.statusHistory = history;
  }
  next();
});

refundSchema.index({ userId: 1, createdAt: -1 });
refundSchema.index({ orderId: 1, createdAt: -1 });
refundSchema.index({ status: 1, createdAt: -1 });

const Refund = mongoose.model("Refund", refundSchema);

export default Refund;
