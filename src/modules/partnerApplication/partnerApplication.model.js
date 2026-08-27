import mongoose from "mongoose";

const partnerApplicationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    vehicleType: { type: String, enum: ["BIKE", "SCOOTER", "CAR", "EV_BIKE", "OTHER"], required: true },
    vehicleRegistrationNumber: { type: String, required: true, trim: true, uppercase: true, maxlength: 20 },
    vehicleMakeModel: { type: String, trim: true, default: "", maxlength: 100 },
    status: { type: String, enum: ["PENDING", "APPROVED", "REJECTED"], default: "PENDING", index: true },
    rejectionReason: { type: String, trim: true, default: "", maxlength: 500 },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

partnerApplicationSchema.index({ status: 1, createdAt: -1 });
partnerApplicationSchema.index({ vehicleRegistrationNumber: 1 }, { unique: true });

export default mongoose.model("PartnerApplication", partnerApplicationSchema);
