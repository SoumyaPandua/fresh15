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

const workflowStateSchema = new mongoose.Schema(
  {
    mode: {
      type: String,
      enum: [
        "IDLE",
        "PRODUCT_SELECTION",
        "QUANTITY_SELECTION",
        "UNIT_SELECTION",
        "ADDRESS_SELECTION",
        "ADDRESS_SERVICEABILITY",
        "DELIVERY_SLOT_SELECTION",
        "PAYMENT_SELECTION",
        "CHECKOUT_REVIEW",
        "PAYMENT_PENDING",
        "ORDER_COMPLETED",
        "ORDER_FAILED",
      ],
      default: "IDLE",
    },
    intent: { type: String, default: null },
    productCandidates: { type: [mongoose.Schema.Types.Mixed], default: [] },
    selectedProductId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
    selectedProductName: { type: String, default: null },
    requestedQuantity: { type: Number, default: null },
    requestedUnit: { type: String, default: null },
    selectedAddressId: { type: mongoose.Schema.Types.ObjectId, ref: "Address", default: null },
    selectedSlotId: { type: String, default: null },
    selectedDateKey: { type: String, default: null },
    paymentMethod: { type: String, enum: ["COD", "ONLINE", null], default: null },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
    orderNumber: { type: String, default: null },
    confirmationId: { type: String, default: null },
    confirmationExpiresAt: { type: Date, default: null },
    lastErrorCode: { type: String, default: null },
    summary: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false },
);

const aiConversationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      default: "Fresh15 AI Chat",
      maxlength: 120,
    },
    messages: { type: [aiMessageSchema], default: [] },
    pendingAction: { type: pendingActionSchema, default: undefined },
    workflowState: {
      type: workflowStateSchema,
      default: () => ({}),
    },
    lastIpAddress: { type: String, default: null, index: true },
    lastUserAgent: { type: String, default: null },
    messageCount: { type: Number, default: 0 },
    lastActivityAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true, versionKey: false },
);

aiConversationSchema.index({ userId: 1, lastActivityAt: -1 });

export default mongoose.model("AiConversation", aiConversationSchema);
