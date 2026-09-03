import mongoose from "mongoose";

const outboxSchema = new mongoose.Schema({
  eventKey: { type: String, required: true, unique: true, index: true },
  type: { type: String, required: true, index: true },
  aggregateType: { type: String, default: null, index: true },
  aggregateId: { type: String, default: null, index: true },
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
  status: { type: String, enum: ["PENDING", "PROCESSING", "DONE", "FAILED"], default: "PENDING", index: true },
  attempts: { type: Number, default: 0 },
  nextAttemptAt: { type: Date, default: Date.now, index: true },
  lockedAt: { type: Date, default: null },
  processedAt: { type: Date, default: null },
  lastError: { type: String, default: null },
}, { timestamps: true, versionKey: false });

outboxSchema.index({ status: 1, nextAttemptAt: 1 });
outboxSchema.index({ createdAt: 1 }, { expireAfterSeconds: 604800 });

export default mongoose.model("Outbox", outboxSchema);
