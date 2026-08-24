import mongoose from "mongoose";

const auditSchema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    actorRole: {
      type: String,
      default: null,
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    resourceType: {
      type: String,
      required: true,
      index: true,
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    requestId: {
      type: String,
      default: null,
      index: true,
    },
    ipAddress: {
      type: String,
      default: null,
      index: true,
    },
    userAgent: {
      type: String,
      default: null,
    },
    method: {
      type: String,
      default: null,
    },
    path: {
      type: String,
      default: null,
    },
    statusCode: {
      type: Number,
      default: null,
    },
    outcome: {
      type: String,
      enum: ["SUCCESS", "FAILURE", "UNKNOWN"],
      default: "UNKNOWN",
      index: true,
    },
    source: {
      type: String,
      default: "api",
      index: true,
    },
    geo: {
      country: { type: String, default: null },
      region: { type: String, default: null },
      city: { type: String, default: null },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

auditSchema.index({ createdAt: -1 });
auditSchema.index({ actorId: 1, createdAt: -1 });
auditSchema.index({ resourceType: 1, resourceId: 1, createdAt: -1 });
auditSchema.index({ ipAddress: 1, createdAt: -1 });

const Audit = mongoose.model("Audit", auditSchema);
export default Audit;
