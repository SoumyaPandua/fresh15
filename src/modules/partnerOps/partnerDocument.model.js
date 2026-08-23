
import mongoose from "mongoose";

const partnerDocumentSchema = new mongoose.Schema(
  {
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["DRIVING_LICENSE", "RC", "INSURANCE", "PAN", "OTHER"],
      required: true,
    },
    documentNumber: {
      type: String,
      default: "",
      trim: true,
      maxlength: 100,
    },
    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "VERIFIED", "REJECTED"],
      default: "PENDING",
    },
    fileUrl: {
      type: String,
      default: "",
    },
    notes: {
      type: String,
      default: "",
      maxlength: 500,
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

partnerDocumentSchema.index({ partnerId: 1, type: 1 }, { unique: true });

export default mongoose.model("PartnerDocument", partnerDocumentSchema);
