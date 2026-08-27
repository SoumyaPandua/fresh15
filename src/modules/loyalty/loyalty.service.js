import crypto from "crypto";
import mongoose from "mongoose";
import Order from "../order/order.model.js";
import { LoyaltyLedger, LoyaltyWallet } from "./loyalty.model.js";
import AppError from "../../utils/AppError.js";
import { sendNotificationService } from "../notification/notification.service.js";

export const LOYALTY = Object.freeze({
  RUPEES_PER_EARN_POINT: 10,
  POINTS_PER_RUPEE_REDEEMED: 10,
  FIRST_REORDER_BONUS: 50,
  REFERRER_REWARD: 100,
  REFERRED_FRIEND_REWARD: 100,
  MAX_REDEMPTION_PERCENT: 20,
  MIN_REDEMPTION_POINTS: 50,
});

const makeReferralCode = (userId) =>
  `F15${String(userId).slice(-6).toUpperCase()}${crypto.randomBytes(2).toString("hex").toUpperCase()}`;

export async function getOrCreateWallet(userId, session) {
  const query = LoyaltyWallet.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId, referralCode: makeReferralCode(userId) } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  if (session) query.session(session);
  return query;
}

async function addLedgerEntry({ userId, type, points, idempotencyKey, orderId = null, relatedUserId = null, description = "", metadata = {} }) {
  const existing = await LoyaltyLedger.findOne({ idempotencyKey });
  if (existing) return { entry: existing, created: false };

  const session = await mongoose.startSession();
  try {
    let entry;
    let created = false;

    await session.withTransaction(async () => {
      const locked = await LoyaltyLedger.findOne({ idempotencyKey }).session(session);
      if (locked) {
        entry = locked;
        return;
      }

      const wallet = await getOrCreateWallet(userId, session);
      const balance = Number(wallet.balance || 0);
      const nextBalance = balance + points;
      if (nextBalance < 0) throw new AppError(409, "INSUFFICIENT_POINTS", "You do not have enough FreshPoints");

      const rows = await LoyaltyLedger.create(
        [{ userId, type, points, balanceAfter: nextBalance, orderId, relatedUserId, idempotencyKey, description, metadata }],
        { session },
      );
      entry = rows[0];

      const update = {
        $set: { balance: nextBalance },
      };
      if (points > 0) update.$inc = { lifetimeEarned: points };
      else if (points < 0) update.$inc = { lifetimeRedeemed: Math.abs(points) };

      await LoyaltyWallet.updateOne({ _id: wallet._id }, update, { session });
      created = true;
    });

    return { entry, created };
  } finally {
    await session.endSession();
  }
}

export async function getLoyaltyOverviewService(userId) {
  const wallet = await getOrCreateWallet(userId);
  const ledger = await LoyaltyLedger.find({ userId }).sort({ createdAt: -1 }).limit(50).lean();
  const referredCount = await LoyaltyWallet.countDocuments({ referredByUserId: userId });
  const successfulReferrals = await LoyaltyLedger.countDocuments({ userId, type: "REFERRAL_REWARD" });

  return {
    wallet,
    ledger,
    referral: { code: wallet.referralCode, referredCount, successfulReferrals },
    rules: LOYALTY,
    redemptionValueRupees: Number((wallet.balance / LOYALTY.POINTS_PER_RUPEE_REDEEMED).toFixed(2)),
  };
}

export async function applyReferralCodeService(userId, code) {
  const wallet = await getOrCreateWallet(userId);
  if (wallet.referredByUserId) throw new AppError(409, "REFERRAL_ALREADY_APPLIED", "A referral code is already linked to your account");

  if (await Order.exists({ userId, orderStatus: "DELIVERED", isDeleted: false })) {
    throw new AppError(409, "REFERRAL_TOO_LATE", "Referral code must be applied before your first delivered order");
  }

  const referrer = await LoyaltyWallet.findOne({ referralCode: String(code || "").trim().toUpperCase() });
  if (!referrer) throw new AppError(404, "REFERRAL_NOT_FOUND", "Referral code not found");
  if (String(referrer.userId) === String(userId)) throw new AppError(409, "SELF_REFERRAL", "You cannot use your own referral code");

  const updated = await LoyaltyWallet.findOneAndUpdate(
    { _id: wallet._id, referredByUserId: null },
    { $set: { referredByUserId: referrer.userId, referralAppliedAt: new Date() } },
    { new: true },
  );

  if (!updated) throw new AppError(409, "REFERRAL_ALREADY_APPLIED", "A referral code is already linked to your account");
  return { referralCode: referrer.referralCode, applied: true };
}

export async function calculateRedemptionService(userId, subtotal, requestedPoints = 0) {
  const wallet = await getOrCreateWallet(userId);
  const safeSubtotal = Math.max(0, Number(subtotal) || 0);
  const capRupees = Number((safeSubtotal * LOYALTY.MAX_REDEMPTION_PERCENT / 100).toFixed(2));
  const capPoints = Math.floor(capRupees * LOYALTY.POINTS_PER_RUPEE_REDEEMED);
  const maxRedeemablePoints = Math.max(0, Math.min(wallet.balance, capPoints));
  const requested = Math.max(0, Math.floor(Number(requestedPoints) || 0));

  if (requested > 0 && requested < LOYALTY.MIN_REDEMPTION_POINTS) {
    throw new AppError(422, "MIN_REDEMPTION", `Redeem at least ${LOYALTY.MIN_REDEMPTION_POINTS} FreshPoints`);
  }

  const pointsToRedeem = Math.min(requested, maxRedeemablePoints);
  return {
    balance: wallet.balance,
    maxRedeemablePoints,
    pointsToRedeem,
    discountRupees: Number((pointsToRedeem / LOYALTY.POINTS_PER_RUPEE_REDEEMED).toFixed(2)),
    capPercent: LOYALTY.MAX_REDEMPTION_PERCENT,
    minimumPoints: LOYALTY.MIN_REDEMPTION_POINTS,
  };
}

export async function reserveOrderRedemptionService(userId, orderId, points) {
  const p = Math.max(0, Math.floor(Number(points) || 0));
  if (!p) return null;
  return (await addLedgerEntry({
    userId,
    type: "REDEEM",
    points: -p,
    orderId,
    idempotencyKey: `redeem:${orderId}`,
    description: `Redeemed ${p} FreshPoints on order`,
  })).entry;
}

export async function refundOrderRedemptionService(order) {
  const points = Math.max(0, Number(order?.loyaltyPointsRedeemed) || 0);
  if (!points || !order?._id) return null;

  if (!(await LoyaltyLedger.findOne({ idempotencyKey: `redeem:${order._id}` }))) return null;
  return (await addLedgerEntry({
    userId: order.userId,
    type: "ADJUSTMENT",
    points,
    orderId: order._id,
    idempotencyKey: `redeem-refund:${order._id}`,
    description: `FreshPoints returned for cancelled order ${order.orderNumber}`,
  })).entry;
}

export async function rewardDeliveredOrderService(orderOrId) {
  const order = typeof orderOrId === "object" && orderOrId?._id ? orderOrId : await Order.findById(orderOrId);
  if (!order || order.orderStatus !== "DELIVERED") return null;

  const eligibleSpend = Math.max(0, Number(order.subtotal || 0) - Number(order.couponDiscount || 0) - Number(order.loyaltyDiscount || 0));
  const basePoints = Math.floor(eligibleSpend / LOYALTY.RUPEES_PER_EARN_POINT);

  if (basePoints > 0) {
    const result = await addLedgerEntry({
      userId: order.userId,
      type: "EARN_ORDER",
      points: basePoints,
      orderId: order._id,
      idempotencyKey: `earn-order:${order._id}`,
      description: `Earned on delivered order ${order.orderNumber}`,
      metadata: { eligibleSpend },
    });
    if (result.created) await safeNotify(order.userId, "FreshPoints earned 🎉", `You earned ${basePoints} FreshPoints on ${order.orderNumber}.`, order.userId, { orderId: order._id, points: basePoints });
  }

  const priorDelivered = await Order.countDocuments({
    userId: order.userId,
    orderStatus: "DELIVERED",
    _id: { $ne: order._id },
    createdAt: { $lt: order.createdAt },
    isDeleted: false,
  });

  if (priorDelivered === 1) {
    await addLedgerEntry({
      userId: order.userId,
      type: "BONUS_FIRST_REORDER",
      points: LOYALTY.FIRST_REORDER_BONUS,
      orderId: order._id,
      idempotencyKey: `first-reorder:${order.userId}`,
      description: "First reorder bonus",
    });
  }

  if (priorDelivered === 0) {
    const wallet = await getOrCreateWallet(order.userId);
    if (wallet.referredByUserId) {
      const referrerId = wallet.referredByUserId;
      const a = await addLedgerEntry({
        userId: referrerId,
        type: "REFERRAL_REWARD",
        points: LOYALTY.REFERRER_REWARD,
        orderId: order._id,
        relatedUserId: order.userId,
        idempotencyKey: `referrer:${order.userId}`,
        description: "Successful referral reward",
      });
      const b = await addLedgerEntry({
        userId: order.userId,
        type: "REFERRED_FRIEND_REWARD",
        points: LOYALTY.REFERRED_FRIEND_REWARD,
        orderId: order._id,
        relatedUserId: referrerId,
        idempotencyKey: `referred-friend:${order.userId}`,
        description: "Welcome referral reward",
      });

      if (a.created) await safeNotify(referrerId, "Referral reward unlocked 🎁", `Your friend completed their first delivery. ${LOYALTY.REFERRER_REWARD} FreshPoints were added.`, referrerId, { points: LOYALTY.REFERRER_REWARD });
      if (b.created) await safeNotify(order.userId, "Referral reward unlocked 🎁", `${LOYALTY.REFERRED_FRIEND_REWARD} FreshPoints were added after your first delivered order.`, order.userId, { points: LOYALTY.REFERRED_FRIEND_REWARD });
    }
  }

  return true;
}

async function safeNotify(userId, title, message, createdBy, metadata) {
  try {
    await sendNotificationService({ userId, title, message, type: "LOYALTY_REWARD", channel: "IN_APP", metadata, createdBy });
  } catch (error) {
    console.error("Loyalty notification failed:", error.message);
  }
}

export async function getAdminLoyaltySummaryService() {
  const [wallets, ledgerAgg, referrals, topWallets] = await Promise.all([
    LoyaltyWallet.countDocuments(),
    LoyaltyLedger.aggregate([
      {
        $group: {
          _id: null,
          earned: { $sum: { $cond: [{ $gt: ["$points", 0] }, "$points", 0] } },
          redeemed: { $sum: { $cond: [{ $lt: ["$points", 0] }, { $abs: "$points" }, 0] } },
        },
      },
    ]),
    LoyaltyLedger.countDocuments({ type: "REFERRAL_REWARD" }),
    LoyaltyWallet.find().sort({ lifetimeEarned: -1 }).limit(10).populate("userId", "name email phone").lean(),
  ]);

  const agg = ledgerAgg[0] || { earned: 0, redeemed: 0 };
  return { wallets, pointsIssued: agg.earned, pointsRedeemed: agg.redeemed, successfulReferrals: referrals, topWallets };
}

export async function getAdminLoyaltyLedgerService(limit = 200) {
  return LoyaltyLedger.find().sort({ createdAt: -1 }).limit(Math.min(500, Math.max(1, Number(limit) || 200))).populate("userId", "name email phone").populate("relatedUserId", "name email").lean();
}
