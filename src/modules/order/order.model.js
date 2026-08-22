import mongoose from "mongoose";
import AppError from "../../utils/AppError.js";

const SUBSTITUTION_PREFERENCES = [
  "CALL_ME",
  "BEST_SIMILAR_ITEM",
  "DO_NOT_SUBSTITUTE",
  "SPECIFIC_ITEM",
];

const substitutionPreferenceSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: SUBSTITUTION_PREFERENCES,
      default: "CALL_ME",
      required: true,
    },

    preferredReplacementProductId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },

    preferredReplacementProductName: {
      type: String,
      default: "",
    },

    preferredReplacementSku: {
      type: String,
      default: "",
    },

    preferredReplacementImage: {
      type: String,
      default: null,
    },
  },
  {
    _id: false,
  }
);

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    productName: { type: String, required: true },
    image: { type: String, default: null },
    sku: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    subtotal: { type: Number, required: true, min: 0 },

    substitutionPreference: {
      type: substitutionPreferenceSchema,
      default: () => ({ type: "CALL_ME" }),
    },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    addressId: { type: mongoose.Schema.Types.ObjectId, ref: "Address", required: true },
    zoneId: { type: mongoose.Schema.Types.ObjectId, ref: "DeliveryZone", default: null, index: true },
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: "DeliveryStore", default: null, index: true },
    deliverySlotId: { type: mongoose.Schema.Types.ObjectId, ref: "DeliverySlot", default: null },
    deliveryDateKey: { type: String, default: "" },
    deliverySlotLabel: { type: String, default: "" },
    promisedDeliveryAt: { type: Date, default: null, index: true },
    items: { type: [orderItemSchema], required: true },
    totalItems: { type: Number, required: true },
    totalQuantity: { type: Number, required: true },
    subtotal: { type: Number, required: true, min: 0 },
    deliveryCharge: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    couponId: { type: mongoose.Schema.Types.ObjectId, ref: "Coupon", default: null },
    couponCode: { type: String, default: "" },
    couponDiscount: { type: Number, default: 0, min: 0 },
    loyaltyPointsRedeemed: { type: Number, default: 0, min: 0 },
    loyaltyDiscount: { type: Number, default: 0, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    grandTotal: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, enum: ["COD", "ONLINE"], required: true },
    paymentStatus: { type: String, enum: ["PENDING", "PAID", "FAILED", "REFUNDED"], default: "PENDING" },
    paymentExpiresAt: { type: Date, default: null, index: true },
    orderStatus: {
      type: String,
      enum: ["PENDING", "CONFIRMED", "PACKING", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"],
      default: "PENDING",
    },
    stockReserved: { type: Boolean, default: false },
    stockFinalized: { type: Boolean, default: false },
    couponUsageRecorded: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    notes: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ orderStatus: 1, createdAt: -1 });

// Never allow a COD order to become DELIVERED while its payment is still pending.
// This protects every save path, including the delivery module which updates
// orderStatus directly instead of going through updateOrderStatusService.
orderSchema.pre("save", function () {
  if (
    this.isModified("orderStatus") &&
    this.orderStatus === "DELIVERED" &&
    this.paymentMethod === "COD" &&
    this.paymentStatus !== "PAID"
  ) {
    throw new AppError(
      409,
      "COD_PAYMENT_REQUIRED",
      "COD payment must be collected before the order can be delivered"
    );
  }
});

export { SUBSTITUTION_PREFERENCES };

const Order = mongoose.model("Order", orderSchema);
export default Order;