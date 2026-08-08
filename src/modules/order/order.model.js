import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    productName: {
      type: String,
      required: true,
    },

    image: {
      type: String,
      default: null,
    },

    sku: {
      type: String,
      required: true,
    },

    price: {
      type: Number,
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    subtotal: {
      type: Number,
      required: true,
    },
  },
  {
    _id: false,
  }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    addressId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Address",
      required: true,
    },

    items: {
      type: [orderItemSchema],
      required: true,
    },

    totalItems: {
      type: Number,
      required: true,
    },

    totalQuantity: {
      type: Number,
      required: true,
    },

    subtotal: {
      type: Number,
      required: true,
    },

    deliveryCharge: {
      type: Number,
      default: 0,
    },

    discount: {
      type: Number,
      default: 0,
    },

    couponId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
      default: null,
    },

    couponCode: {
      type: String,
      default: "",
    },

    couponDiscount: {
      type: Number,
      default: 0,
    },

    tax: {
      type: Number,
      default: 0,
    },

    grandTotal: {
      type: Number,
      required: true,
    },

    paymentMethod: {
      type: String,
      enum: [
        "COD",
        "ONLINE",
      ],
      required: true,
    },

    paymentStatus: {
      type: String,
      enum: [
        "PENDING",
        "PAID",
        "FAILED",
        "REFUNDED",
      ],
      default: "PENDING",
    },

    orderStatus: {
      type: String,
      enum: [
        "PENDING",
        "CONFIRMED",
        "PACKING",
        "READY_FOR_PICKUP",
        "OUT_FOR_DELIVERY",
        "DELIVERED",
        "CANCELLED",
      ],
      default: "PENDING",
    },


    notes: {
      type: String,
      default: "",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Order = mongoose.model("Order", orderSchema);

export default Order;