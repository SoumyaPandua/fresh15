import mongoose from "mongoose";

const loyaltyWalletSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
  balance: { type: Number, default: 0, min: 0 },
  lifetimeEarned: { type: Number, default: 0, min: 0 },
  lifetimeRedeemed: { type: Number, default: 0, min: 0 },
  referralCode: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
  referredByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  referralAppliedAt: { type: Date, default: null },
}, { timestamps: true });

const loyaltyLedgerSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  type: { type: String, enum: ["EARN_ORDER", "BONUS_FIRST_REORDER", "REFERRAL_REWARD", "REFERRED_FRIEND_REWARD", "REDEEM", "ADJUSTMENT"], required: true, index: true },
  points: { type: Number, required: true },
  balanceAfter: { type: Number, required: true, min: 0 },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null, index: true },
  relatedUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  idempotencyKey: { type: String, required: true, unique: true, index: true },
  description: { type: String, default: "" },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

loyaltyLedgerSchema.index({ userId: 1, createdAt: -1 });

export const LoyaltyWallet = mongoose.model("LoyaltyWallet", loyaltyWalletSchema);
export const LoyaltyLedger = mongoose.model("LoyaltyLedger", loyaltyLedgerSchema);
