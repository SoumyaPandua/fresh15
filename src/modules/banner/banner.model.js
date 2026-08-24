import mongoose from "mongoose";

const TARGET_TYPES = ["NONE", "SEARCH", "CATEGORY", "PRODUCT", "OFFER"];

const bannerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    subtitle: { type: String, default: "", trim: true, maxlength: 300 },
    placement: { type: String, default: "HOME_PROMO", trim: true, maxlength: 100, index: true },
    image: { type: String, required: true, trim: true },
    imagePublicId: { type: String, default: null },
    ctaText: { type: String, default: "Shop now", trim: true, maxlength: 40 },
    targetType: { type: String, enum: TARGET_TYPES, default: "SEARCH", index: true },
    targetValue: { type: String, default: "", trim: true, maxlength: 200 },
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

bannerSchema.index({ isActive: 1, isDeleted: 1, placement: 1, priority: -1, createdAt: -1 });

const Banner = mongoose.model("Banner", bannerSchema);
export default Banner;
