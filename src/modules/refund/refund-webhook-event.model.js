import mongoose from "mongoose";

const schema = new mongoose.Schema(
  { eventId: { type: String, required: true, unique: true, index: true }, event: { type: String, default: "" } },
  { timestamps: true, versionKey: false },
);

schema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });
export default mongoose.model("RefundWebhookEvent", schema);
