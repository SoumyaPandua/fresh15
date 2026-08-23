
import mongoose from "mongoose";

const partnerShiftSchema = new mongoose.Schema(
  {
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    dateKey: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      index: true,
    },
    startAt: {
      type: Date,
      required: true,
      index: true,
    },
    endAt: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["SCHEDULED", "ACTIVE", "COMPLETED", "CANCELLED"],
      default: "SCHEDULED",
      index: true,
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
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

partnerShiftSchema.index({ partnerId: 1, startAt: 1 });
partnerShiftSchema.index({ partnerId: 1, endAt: 1 });

export default mongoose.model("PartnerShift", partnerShiftSchema);
