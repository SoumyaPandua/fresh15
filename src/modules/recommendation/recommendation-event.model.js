import mongoose from "mongoose";

const recommendationEventSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  eventType: {
    type: String,
    enum: ["IMPRESSION", "CLICK", "ADD_TO_CART", "PURCHASE", "DISMISS", "OFFER_IMPRESSION", "OFFER_CLICK"],
    required: true,
  },
  surface: {
    type: String,
    enum: ["HOME", "SEARCH", "CATEGORY", "PRODUCT", "CART", "CHECKOUT", "OFFERS", "OTHER"],
    default: "HOME",
    index: true,
  },
  recommendationType: {
    type: String,
    enum: ["PERSONALIZED", "SMART_BASKET", "OFFER", "SEASONAL", "POPULAR"],
    default: "PERSONALIZED",
    index: true,
  },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null, index: true },
  offerId: { type: mongoose.Schema.Types.ObjectId, ref: "Offer", default: null, index: true },
  recommendationRequestId: { type: String, default: null, maxlength: 100, trim: true },
  position: { type: Number, min: 0, max: 200, default: null },
  sessionId: { type: String, default: null, maxlength: 100, trim: true },
}, {
  timestamps: { createdAt: true, updatedAt: false },
  versionKey: false,
});

recommendationEventSchema.index({ userId: 1, createdAt: -1 });
recommendationEventSchema.index({ offerId: 1, eventType: 1, createdAt: -1 });
recommendationEventSchema.index({ productId: 1, eventType: 1, createdAt: -1 });
recommendationEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 31536000 });

export default mongoose.model("RecommendationEvent", recommendationEventSchema);
