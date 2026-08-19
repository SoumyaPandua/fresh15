import mongoose from "mongoose";

const deliverySlotDaySchema = new mongoose.Schema(
  {
    slotId: { type: mongoose.Schema.Types.ObjectId, ref: "DeliverySlot", required: true, index: true },
    dateKey: { type: String, required: true, index: true },
    booked: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

deliverySlotDaySchema.index({ slotId: 1, dateKey: 1 }, { unique: true });
export default mongoose.model("DeliverySlotDay", deliverySlotDaySchema);
