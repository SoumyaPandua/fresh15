import mongoose from "mongoose";

const productAlertSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },

    backInStock: {
      type: Boolean,
      default: false,
    },

    priceDrop: {
      type: Boolean,
      default: false,
    },

    // Optional target price. When set, the alert fires when the price
    // crosses from above this value to at/below it.
    targetPrice: {
      type: Number,
      min: 0,
      default: null,
    },

    inAppEnabled: {
      type: Boolean,
      default: true,
    },

    emailEnabled: {
      type: Boolean,
      default: false,
    },

    lastNotifiedPrice: {
      type: Number,
      min: 0,
      default: null,
    },

    lastPriceDropNotifiedAt: {
      type: Date,
      default: null,
    },

    backInStockNotifiedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

productAlertSchema.index(
  { userId: 1, productId: 1 },
  { unique: true }
);

productAlertSchema.index({
  productId: 1,
  backInStock: 1,
});

productAlertSchema.index({
  productId: 1,
  priceDrop: 1,
});

const ProductAlert = mongoose.model(
  "ProductAlert",
  productAlertSchema
);

export default ProductAlert;
