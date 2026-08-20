import mongoose from "mongoose";

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
  },
  {
    _id: false,
  }
);

const cartItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    price: {
      type: Number,
      required: true,
    },

    subtotal: {
      type: Number,
      required: true,
    },

    substitutionPreference: {
      type: substitutionPreferenceSchema,
      default: () => ({ type: "CALL_ME" }),
    },
  },
  {
    _id: false,
  }
);

const cartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    items: {
      type: [cartItemSchema],
      default: [],
    },

    totalItems: {
      type: Number,
      default: 0,
    },

    totalQuantity: {
      type: Number,
      default: 0,
    },

    subtotal: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

cartSchema.methods.calculateTotals = function () {
  this.totalItems = this.items.length;

  this.totalQuantity = this.items.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  this.subtotal = this.items.reduce(
    (sum, item) => sum + item.subtotal,
    0
  );
};

export { SUBSTITUTION_PREFERENCES };

const Cart = mongoose.model("Cart", cartSchema);

export default Cart;