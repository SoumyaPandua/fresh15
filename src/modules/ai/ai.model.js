import mongoose from "mongoose";

const aiMessageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true, maxlength: 6000 },
    blocked: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const pendingActionSchema = new mongoose.Schema(
  {
    confirmationId: { type: String, required: true, index: true },
    action: { type: String, required: true },
    args: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
  },
  { _id: false },
);

const aiConversationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, default: "Fresh15 AI Chat", maxlength: 120 },
    messages: { type: [aiMessageSchema], default: [] },
    pendingAction: { type: pendingActionSchema, default: undefined },
    lastIpAddress: { type: String, default: null, index: true },
    lastUserAgent: { type: String, default: null },
    messageCount: { type: Number, default: 0 },
    lastActivityAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true, versionKey: false },
);

aiConversationSchema.index({ userId: 1, lastActivityAt: -1 });

export default mongoose.model("AiConversation", aiConversationSchema);
