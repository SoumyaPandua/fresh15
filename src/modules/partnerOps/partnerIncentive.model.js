
import mongoose from "mongoose";

const partnerIncentiveSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      default: "",
      maxlength: 500,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    targetDeliveries: {
      type: Number,
      required: true,
      min: 1,
    },
    startAt: {
      type: Date,
      required: true,
      index: true,
    },
    endAt: {
      type: Date,
      required: true,
      index: true,
    },
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
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
  { timestamps: true }
);

partnerIncentiveSchema.index({ active: 1, startAt: 1, endAt: 1 });

export default mongoose.model("PartnerIncentive", partnerIncentiveSchema);
