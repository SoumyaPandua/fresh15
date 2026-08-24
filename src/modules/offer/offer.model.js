import mongoose from "mongoose";

const TARGET_TYPES = ["NONE", "SEARCH", "CATEGORY", "PRODUCT", "OFFER"];

const offerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, default: "", trim: true, maxlength: 500 },
    discount: { type: String, required: true, trim: true, maxlength: 50 },
    category: { type: String, required: true, trim: true, lowercase: true, maxlength: 100, index: true },
    placement: { type: String, default: "HOME", trim: true, maxlength: 50, index: true },
    ctaText: { type: String, default: "View offer", trim: true, maxlength: 40 },
    targetType: { type: String, enum: TARGET_TYPES, default: "SEARCH", index: true },
    targetValue: { type: String, default: "", trim: true, maxlength: 200 },
    couponCode: { type: String, default: "", trim: true, uppercase: true, maxlength: 50, index: true },
    priority: { type: Number, default: 0, min: 0, max: 1000, index: true },
    startsAt: { type: Date, default: null, index: true },
    endsAt: { type: Date, default: null, index: true },
    isActive: { type: Boolean, default: true, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

offerSchema.index({ isActive: 1, isDeleted: 1, placement: 1, priority: -1, createdAt: -1 });

const Offer = mongoose.model("Offer", offerSchema);
export default Offer;
