import mongoose from "mongoose";

const deliveryStoreSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    latitude: { type: Number, default: null, min: -90, max: 90 },
    longitude: { type: Number, default: null, min: -180, max: 180 },
    serviceRadiusKm: { type: Number, default: 10, min: 0, max: 100 },
    maxConcurrentOrders: { type: Number, default: 100, min: 1, max: 100000 },
    prepMinutes: { type: Number, default: 8, min: 0, max: 240 },
    active: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

deliveryStoreSchema.index({ active: 1 });
export default mongoose.models.DeliveryStore ||
  mongoose.model("DeliveryStore", deliveryStoreSchema);
