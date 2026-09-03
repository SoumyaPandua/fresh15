
import mongoose from "mongoose";

const rowSchema = new mongoose.Schema({
  rowNumber: { type: Number, required: true },
  sku: { type: String, required: true },
  raw: { type: mongoose.Schema.Types.Mixed, default: {} },
  normalized: { type: mongoose.Schema.Types.Mixed, default: {} },
  issues: { type: [String], default: [] },
  warnings: { type: [String], default: [] },
  status: { type: String, enum: ["PENDING", "PROCESSED", "FAILED", "SKIPPED"], default: "PENDING" },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
  images: { type: [String], default: [] },
  imageStatus: { type: String, enum: ["NOT_REQUIRED", "PENDING", "PROCESSING", "PROCESSED", "FAILED"], default: "NOT_REQUIRED" },
  error: { type: String, default: null },
}, { _id: true });

const catalogImportSchema = new mongoose.Schema({
  importKey: { type: String, required: true, unique: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  status: { type: String, enum: ["PREVIEW", "QUEUED", "PROCESSING", "COMPLETED", "COMPLETED_WITH_ERRORS", "FAILED", "CANCELLED"], default: "PREVIEW", index: true },
  fileName: { type: String, default: "catalog.csv", trim: true },
  rowCount: { type: Number, default: 0 },
  processedCount: { type: Number, default: 0 },
  successCount: { type: Number, default: 0 },
  failedCount: { type: Number, default: 0 },
  skippedCount: { type: Number, default: 0 },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  lastError: { type: String, default: null },
  rows: { type: [rowSchema], default: [] },
}, { timestamps: true, versionKey: false });

catalogImportSchema.index({ status: 1, createdAt: -1 });
catalogImportSchema.index({ createdBy: 1, createdAt: -1 });

export default mongoose.model("CatalogImportJob", catalogImportSchema);
