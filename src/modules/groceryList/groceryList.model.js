import mongoose from "mongoose";
const itemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  quantity: { type: Number, required: true, min: 1, max: 50 },
}, { _id: false });
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  description: { type: String, default: "", trim: true, maxlength: 240 },
  listType: { type: String, enum: ["WEEKLY_ESSENTIALS", "CUSTOM"], default: "CUSTOM", index: true },
  repeatInterval: { type: String, enum: ["NONE", "WEEKLY"], default: "NONE" },
  isPinned: { type: Boolean, default: false, index: true },
  items: { type: [itemSchema], default: [], validate: { validator: (items) => items.length <= 40, message: "A grocery list can contain at most 40 items" } },
  lastAddedToCartAt: { type: Date, default: null },
}, { timestamps: true });
schema.index({ userId: 1, isPinned: -1, updatedAt: -1 });
schema.index({ userId: 1, listType: 1 });
schema.pre("validate", function () { if (this.listType === "WEEKLY_ESSENTIALS") this.repeatInterval = "WEEKLY"; });
export default mongoose.model("GroceryList", schema);
