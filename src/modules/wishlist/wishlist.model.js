import mongoose from "mongoose";

const wishlistItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
  },
  {
    _id: false,
  }
);

const wishlistSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    items: {
      type: [wishlistItemSchema],
      default: [],
    },

    totalItems: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

wishlistSchema.methods.calculateTotals = function () {
  this.totalItems = this.items.length;
};

const Wishlist = mongoose.model("Wishlist", wishlistSchema);

export default Wishlist;