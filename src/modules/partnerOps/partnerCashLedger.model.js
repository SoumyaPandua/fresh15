
import mongoose from "mongoose";

const partnerCashLedgerSchema = new mongoose.Schema(
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
    type: {
      type: String,
      enum: ["COD_COLLECTION", "RECONCILIATION", "ADJUSTMENT"],
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    note: {
      type: String,
      default: "",
      maxlength: 300,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

partnerCashLedgerSchema.index({ partnerId: 1, createdAt: -1 });
partnerCashLedgerSchema.index(
  { deliveryId: 1, type: 1 },
  { unique: true, partialFilterExpression: { deliveryId: { $type: "objectId" }, type: "COD_COLLECTION" } }
);

export default mongoose.model("PartnerCashLedger", partnerCashLedgerSchema);
