import mongoose from "mongoose";

const deliverySlotSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 80 },
    type: { type: String, enum: ["ASAP", "FIXED"], default: "FIXED", index: true },
    fromMinutes: { type: Number, required: true, min: 0, max: 1439 },
    toMinutes: { type: Number, required: true, min: 1, max: 1440 },
    leadTimeMinutes: { type: Number, default: 15, min: 0, max: 1440 },
    cutoffMinutesBeforeStart: { type: Number, default: 0, min: 0, max: 1440 },
    capacity: { type: Number, required: true, min: 1, max: 10000 },

    active: { type: Boolean, default: true }, // removed index:true

    sortOrder: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

deliverySlotSchema.index({ active: 1, sortOrder: 1, fromMinutes: 1 });

export default mongoose.model("DeliverySlot", deliverySlotSchema);