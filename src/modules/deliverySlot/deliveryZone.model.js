import mongoose from "mongoose";

const deliveryZoneSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    pincodes: { type: [String], default: [] },
    city: { type: String, default: "", trim: true },
    latitude: { type: Number, default: null, min: -90, max: 90 },
    longitude: { type: Number, default: null, min: -180, max: 180 },
    serviceRadiusKm: { type: Number, default: 5, min: 0, max: 100 },
    fee: { type: Number, default: 0, min: 0 },
    minOrder: { type: Number, default: 0, min: 0 },
    maxConcurrentOrders: { type: Number, default: 100, min: 1, max: 100000 },
    travelMinutes: { type: Number, default: 10, min: 0, max: 240 },
    workloadDelayMinutes: { type: Number, default: 3, min: 0, max: 60 },
    active: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

deliveryZoneSchema.index({ pincodes: 1, active: 1 });
deliveryZoneSchema.index({ active: 1, latitude: 1, longitude: 1 });
export default mongoose.model("DeliveryZone", deliveryZoneSchema);
