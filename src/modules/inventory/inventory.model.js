import mongoose from "mongoose";

const inventorySchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      unique: true,
      index: true,
    },

    currentStock: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    reservedStock: {
      type: Number,
      default: 0,
      min: 0,
    },

    availableStock: {
      type: Number,
      default: 0,
      min: 0,
    },

    lowStockThreshold: {
      type: Number,
      default: 10,
      min: 0,
    },

    status: {
      type: String,
      enum: [
        "IN_STOCK",
        "LOW_STOCK",
        "OUT_OF_STOCK",
      ],
      default: "OUT_OF_STOCK",
    },

    lastRestockedAt: {
      type: Date,
      default: null,
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

/**
 * Auto calculate available stock & status
 */
inventorySchema.pre("save", function (next) {
  this.availableStock = Math.max(
    this.currentStock - this.reservedStock,
    0
  );

  if (this.availableStock === 0) {
    this.status = "OUT_OF_STOCK";
  } else if (
    this.availableStock <= this.lowStockThreshold
  ) {
    this.status = "LOW_STOCK";
  } else {
    this.status = "IN_STOCK";
  }

  next();
});

const Inventory = mongoose.model(
  "Inventory",
  inventorySchema
);

export default Inventory;