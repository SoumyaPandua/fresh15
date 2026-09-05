import Refund from "./refund.model.js";
import Order from "../order/order.model.js";
import AppError from "../../utils/AppError.js";
import {
  createRefundRequestService,
  processRefundService,
  rejectRefundService,
  completeManualRefundService,
  handleRazorpayRefundWebhookService,
} from "./refund.service.js";

const processedRefundTotal = async (orderId) => {
  const rows = await Refund.aggregate([
    { $match: { orderId, status: "PROCESSED" } },
    { $group: { _id: "$orderId", amount: { $sum: "$amount" } } },
  ]);
  return Number(rows[0]?.amount || 0);
};

const reserveRefundAmount = async (orderId, userId, amount) => {
  const requested = Number(amount);

  if (!Number.isFinite(requested) || requested <= 0) {
    throw new AppError(
      400,
      "INVALID_REFUND_AMOUNT",
      "Refund amount must be greater than zero",
    );
  }

  const processed = await processedRefundTotal(orderId);

  const order = await Order.findOneAndUpdate(
    {
      _id: orderId,
      userId,
      isDeleted: false,
      paymentStatus: "PAID",
      $expr: {
        $lte: [
          {
            $add: [
              processed,
              { $ifNull: ["$refundReservedAmount", 0] },
              requested,
            ],
          },
          "$grandTotal",
        ],
      },
    },
    [
      {
        $set: {
          refundedAmount: processed,
          refundReservedAmount: {
            $add: [
              { $ifNull: ["$refundReservedAmount", 0] },
              requested,
            ],
          },
        },
      },
    ],
    { new: true },
  );

  if (!order) {
    const current = await Order.findOne({
      _id: orderId,
      userId,
      isDeleted: false,
    }).select("grandTotal refundedAmount refundReservedAmount");

    const remaining = Math.max(
      0,
      Number(current?.grandTotal || 0) -
        Number(current?.refundedAmount || 0) -
        Number(current?.refundReservedAmount || 0),
    );

    throw new AppError(
      409,
      "REFUND_AMOUNT_EXCEEDED",
      `Only ₹${remaining.toFixed(2)} remains refundable for this order`,
    );
  }

  return order;
};

export const createRefundRequestWithConcurrency = async (userId, input) => {
  const amount = Number(input.amount);

  await reserveRefundAmount(input.orderId, userId, amount);

  try {
    return await createRefundRequestService(userId, input);
  } catch (error) {
    await Order.updateOne(
      {
        _id: input.orderId,
        userId,
        refundReservedAmount: { $gte: amount },
      },
      { $inc: { refundReservedAmount: -amount } },
    );
    throw error;
  }
};

const settleReservation = async (refundId, mode) => {
  const refund = await Refund.findById(refundId).select(
    "orderId amount status",
  );
  if (!refund) return;

  const amount = Number(refund.amount || 0);

  if (mode === "processed") {
    await Order.findOneAndUpdate(
      {
        _id: refund.orderId,
        refundReservedAmount: { $gte: amount },
      },
      {
        $inc: {
          refundedAmount: amount,
          refundReservedAmount: -amount,
        },
      },
    );
  } else if (mode === "release") {
    await Order.updateOne(
      {
        _id: refund.orderId,
        refundReservedAmount: { $gte: amount },
      },
      { $inc: { refundReservedAmount: -amount } },
    );
  }
};

export const processRefundWithConcurrency = async (adminId, refundId) => {
  try {
    const refund = await processRefundService(adminId, refundId);

    if (refund?.status === "PROCESSED") {
      await settleReservation(refundId, "processed");
    }

    if (refund?.status === "FAILED" || refund?.status === "REJECTED") {
      await settleReservation(refundId, "release");
    }

    return refund;
  } catch (error) {
    const refund = await Refund.findById(refundId).select("status");

    if (refund?.status === "FAILED" || refund?.status === "REJECTED") {
      await settleReservation(refundId, "release");
    }

    throw error;
  }
};

export const rejectRefundWithConcurrency = async (adminId, refundId, reason) => {
  const refund = await rejectRefundService(adminId, refundId, reason);
  await settleReservation(refundId, "release");
  return refund;
};

export const completeManualRefundWithConcurrency = async (
  adminId,
  refundId,
  reference,
) => {
  const refund = await completeManualRefundService(
    adminId,
    refundId,
    reference,
  );
  await settleReservation(refundId, "processed");
  return refund;
};

export const handleRefundWebhookWithConcurrency = async (payload) => {
  const result = await handleRazorpayRefundWebhookService(payload);

  if (result?.refund?.status === "PROCESSED") {
    await settleReservation(result.refund._id, "processed");
  }

  if (result?.refund?.status === "FAILED") {
    await settleReservation(result.refund._id, "release");
  }

  return result;
};
