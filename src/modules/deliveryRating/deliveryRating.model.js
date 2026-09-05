import mongoose from "mongoose";

const deliveryRatingSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, unique: true, index: true },
    deliveryId: { type: mongoose.Schema.Types.ObjectId, ref: "Delivery", required: true, index: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    partnerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
  },
  { timestamps: true },
);

deliveryRatingSchema.index({ customerId: 1, orderId: 1 }, { unique: true });
export default mongoose.model("DeliveryRating", deliveryRatingSchema);
