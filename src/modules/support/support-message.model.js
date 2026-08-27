import mongoose from "mongoose";

const supportMessageSchema = new mongoose.Schema(
  {
    ticketId: { type: mongoose.Schema.Types.ObjectId, ref: "Support", required: true, index: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    senderRole: { type: String, enum: ["CUSTOMER", "ADMIN", "SUPER_ADMIN"], required: true },
    message: { type: String, required: true, trim: true, maxlength: 5000 },
  },
  { timestamps: true },
);

supportMessageSchema.index({ ticketId: 1, createdAt: 1 });
export default mongoose.model("SupportMessage", supportMessageSchema);
