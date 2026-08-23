
import mongoose from "mongoose";

const partnerEarningSchema = new mongoose.Schema(
  {
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    deliveryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Delivery",
      default: null,
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
      index: true,
    },
    incentiveId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PartnerIncentive",
      default: null,
      index: true,
    },
    type: {
      type: String,
      enum: ["ORDER", "INCENTIVE", "ADJUSTMENT"],
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    title: {
      type: String,
      required: true,
      maxlength: 160,
    },
    description: {
      type: String,
      default: "",
      maxlength: 500,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

partnerEarningSchema.index({ partnerId: 1, createdAt: -1 });
partnerEarningSchema.index(
  { partnerId: 1, incentiveId: 1, type: 1 },
  { unique: true, partialFilterExpression: { type: "INCENTIVE", incentiveId: { $type: "objectId" } } }
);
partnerEarningSchema.index(
  { deliveryId: 1, type: 1 },
  { unique: true, partialFilterExpression: { deliveryId: { $type: "objectId" }, type: "ORDER" } }
);

export default mongoose.model("PartnerEarning", partnerEarningSchema);
