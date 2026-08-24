import crypto from "crypto";
import Razorpay from "razorpay";

import Refund from "./refund.model.js";
import Payment from "../payment/payment.model.js";
import Order from "../order/order.model.js";
import { writeAuditLog } from "../audit/audit.service.js";
import { sendNotificationService } from "../notification/notification.service.js";
import AppError from "../../utils/AppError.js";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const ACTIVE_REFUND_STATUSES = [
  "REQUESTED",
  "APPROVED",
  "PROCESSING",
];

const getOrderRefundTotals = async (orderId) => {
  const rows = await Refund.aggregate([
    {
      $match: {
        orderId,
        status: { $in: ["REQUESTED", "APPROVED", "PROCESSING", "PROCESSED"] },
      },
    },
    {
      $group: {
        _id: "$orderId",
        amount: { $sum: "$amount" },
      },
    },
  ]);

  return Number(rows[0]?.amount || 0);
};

const getProcessedRefundTotal = async (orderId) => {
  const rows = await Refund.aggregate([
    {
      $match: {
        orderId,
        status: "PROCESSED",
      },
    },
    {
      $group: {
        _id: "$orderId",
        amount: { $sum: "$amount" },
      },
    },
  ]);

  return Number(rows[0]?.amount || 0);
};

const syncOrderRefundStatus = async (orderId, actorId = null) => {
  const order = await Order.findById(orderId);
  if (!order) return null;

  const processedAmount = await getProcessedRefundTotal(order._id);

  if (processedAmount >= Number(order.grandTotal)) {
    order.paymentStatus = "REFUNDED";
    order.updatedBy = actorId || order.updatedBy;
    await order.save();

    const payment = await Payment.findOne({ orderId: order._id });
    if (payment) {
      payment.status = "REFUNDED";
      payment.refundedAt = payment.refundedAt || new Date();
      payment.updatedBy = actorId || payment.updatedBy;
      await payment.save();
    }
  }

  return order;
};

const notifyCustomer = async (refund, title, message, actorId = null) => {
  try {
    await sendNotificationService({
      userId: refund.userId,
      title,
      message,
      type: "REFUND",
      channel: "IN_APP",
      metadata: {
        refundId: refund._id.toString(),
        orderId: refund.orderId.toString(),
        amount: refund.amount,
        status: refund.status,
      },
      createdBy: actorId || refund.userId,
    });
  } catch (error) {
    console.error("Refund notification failed:", error.message);
  }
};

export const createRefundRequestService = async (userId, { orderId, amount, reason }) => {
  const order = await Order.findOne({
    _id: orderId,
    userId,
    isDeleted: false,
  });

  if (!order) {
    throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");
  }

  if (!["DELIVERED", "CANCELLED"].includes(order.orderStatus)) {
    throw new AppError(
      409,
      "REFUND_NOT_ELIGIBLE",
      "Refunds can only be requested for delivered or cancelled orders"
    );
  }

  if (order.paymentStatus !== "PAID") {
    throw new AppError(
      409,
      "PAYMENT_NOT_REFUNDABLE",
      "Only successfully paid orders can be refunded"
    );
  }

  const requestedAmount = Number(amount);
  if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
    throw new AppError(400, "INVALID_REFUND_AMOUNT", "Refund amount must be greater than zero");
  }

  const reservedAmount = await getOrderRefundTotals(order._id);
  const remaining = Math.max(0, Number(order.grandTotal) - reservedAmount);

  if (requestedAmount > remaining + 0.01) {
    throw new AppError(
      409,
      "REFUND_AMOUNT_EXCEEDED",
      `Only ₹${remaining.toFixed(2)} remains refundable for this order`
    );
  }

  const existingRequest = await Refund.findOne({
    orderId: order._id,
    userId,
    status: { $in: ACTIVE_REFUND_STATUSES },
  });

  if (existingRequest) {
    throw new AppError(
      409,
      "REFUND_REQUEST_EXISTS",
      "This order already has a refund request being processed"
    );
  }

  const refund = await Refund.create({
    orderId: order._id,
    userId,
    paymentId: await Payment.findOne({ orderId: order._id }).then((payment) => payment?._id || null),
    amount: Number(requestedAmount.toFixed(2)),
    currency: "INR",
    reason,
    status: "REQUESTED",
    requestedBy: userId,
  });

  await writeAuditLog({
    actorId: userId,
    action: "REFUND_REQUESTED",
    resourceType: "REFUND",
    resourceId: refund._id,
    details: {
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      amount: refund.amount,
      reason: refund.reason,
    },
  });

  await notifyCustomer(
    refund,
    "Refund request received",
    `Your refund request for order ${order.orderNumber} has been received.`
  );

  return refund;
};

export const getMyRefundsService = async (userId) => {
  return Refund.find({ userId })
    .populate("orderId", "orderNumber grandTotal paymentMethod paymentStatus orderStatus")
    .sort({ createdAt: -1 })
    .lean();
};

export const getRefundByIdService = async (userId, refundId) => {
  const refund = await Refund.findOne({ _id: refundId, userId })
    .populate("orderId", "orderNumber grandTotal paymentMethod paymentStatus orderStatus")
    .lean();

  if (!refund) {
    throw new AppError(404, "REFUND_NOT_FOUND", "Refund not found");
  }

  return refund;
};

export const getAdminRefundsService = async ({
  page = 1,
  limit = 20,
  status = "",
  search = "",
}) => {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));

  const query = {};
  if (status) query.status = status;

  if (search?.trim()) {
    const orders = await Order.find({
      orderNumber: new RegExp(search.trim(), "i"),
    }).select("_id");

    const orderIds = orders.map((order) => order._id);

    query.$or = [
      { orderId: { $in: orderIds } },
      { razorpayRefundId: new RegExp(search.trim(), "i") },
    ];
  }

  const [items, total, summary] = await Promise.all([
    Refund.find(query)
      .populate("orderId", "orderNumber grandTotal paymentMethod paymentStatus orderStatus")
      .populate("userId", "name email phone")
      .populate("processedBy", "name email")
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    Refund.countDocuments(query),
    Refund.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          amount: { $sum: "$amount" },
        },
      },
    ]),
  ]);

  const summaryMap = Object.fromEntries(
    summary.map((item) => [
      item._id,
      {
        count: Number(item.count || 0),
        amount: Number(item.amount || 0),
      },
    ])
  );

  return {
    items,
    summary: {
      requested: summaryMap.REQUESTED || { count: 0, amount: 0 },
      processing:
        summaryMap.PROCESSING || { count: 0, amount: 0 },
      processed:
        summaryMap.PROCESSED || { count: 0, amount: 0 },
      failed: summaryMap.FAILED || { count: 0, amount: 0 },
      manualRequired:
        summaryMap.MANUAL_REQUIRED || { count: 0, amount: 0 },
      rejected:
        summaryMap.REJECTED || { count: 0, amount: 0 },
    },
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.max(1, Math.ceil(total / safeLimit)),
    },
  };
};

export const processRefundService = async (adminId, refundId) => {
  const refund = await Refund.findById(refundId);
  if (!refund) {
    throw new AppError(404, "REFUND_NOT_FOUND", "Refund not found");
  }

  if (!["REQUESTED", "APPROVED", "FAILED"].includes(refund.status)) {
    throw new AppError(
      409,
      "REFUND_NOT_PROCESSABLE",
      `Refund cannot be processed from ${refund.status} status`
    );
  }

  const order = await Order.findById(refund.orderId);
  if (!order) {
    throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");
  }

  const payment = await Payment.findById(refund.paymentId);
  if (!payment) {
    throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment record not found");
  }

  refund.processedBy = adminId;
  refund.status = "APPROVED";
  await refund.save();

  if (order.paymentMethod === "COD") {
    refund.status = "MANUAL_REQUIRED";
    refund.gatewayResponse = {
      mode: "COD",
      message: "COD refund requires manual settlement outside Razorpay",
    };
    await refund.save();

    await writeAuditLog({
      actorId: adminId,
      action: "REFUND_MANUAL_REQUIRED",
      resourceType: "REFUND",
      resourceId: refund._id,
      details: {
        orderId: order._id.toString(),
        amount: refund.amount,
        paymentMethod: "COD",
      },
    });

    await notifyCustomer(
      refund,
      "Refund approved",
      `Your refund for order ${order.orderNumber} was approved and is awaiting manual settlement.`,
      adminId
    );

    return refund;
  }

  if (!payment.razorpayPaymentId) {
    refund.status = "FAILED";
    refund.rejectionReason = "Razorpay payment ID is missing";
    await refund.save();
    throw new AppError(
      409,
      "RAZORPAY_PAYMENT_NOT_FOUND",
      "The original Razorpay payment ID is missing"
    );
  }

  const alreadyRefunded = await getProcessedRefundTotal(order._id);
  const refundableBeforeThis = Number(order.grandTotal) - alreadyRefunded;

  if (refund.amount > refundableBeforeThis + 0.01) {
    refund.status = "FAILED";
    refund.rejectionReason = "Refund amount exceeds remaining refundable amount";
    await refund.save();

    throw new AppError(
      409,
      "REFUND_AMOUNT_EXCEEDED",
      "Refund amount exceeds the remaining refundable amount"
    );
  }

  const receipt = `rf-${refund._id.toString()}`;

  try {
    const gatewayRefund = await razorpay.payments.refund(
      payment.razorpayPaymentId,
      {
        amount: Math.round(refund.amount * 100),
        speed: "normal",
        receipt,
        notes: {
          refund_id: refund._id.toString(),
          order_id: order._id.toString(),
          reason: refund.reason.slice(0, 256),
        },
      }
    );

    refund.razorpayRefundId = gatewayRefund.id;
    refund.gatewayResponse = gatewayRefund;
    refund.status =
      gatewayRefund.status === "processed" ? "PROCESSED" : "PROCESSING";
    refund.processedAt =
      refund.status === "PROCESSED" ? new Date() : null;
    await refund.save();

    if (refund.status === "PROCESSED") {
      await syncOrderRefundStatus(order._id, adminId);
    }

    await writeAuditLog({
      actorId: adminId,
      action: "REFUND_PROCESSED",
      resourceType: "REFUND",
      resourceId: refund._id,
      details: {
        orderId: order._id.toString(),
        razorpayRefundId: refund.razorpayRefundId,
        amount: refund.amount,
        gatewayStatus: gatewayRefund.status,
      },
    });

    await notifyCustomer(
      refund,
      refund.status === "PROCESSED"
        ? "Refund processed"
        : "Refund is processing",
      refund.status === "PROCESSED"
        ? `₹${refund.amount.toFixed(2)} refund for order ${order.orderNumber} has been processed.`
        : `₹${refund.amount.toFixed(2)} refund for order ${order.orderNumber} is being processed.`,
      adminId
    );

    return refund;
  } catch (error) {
    refund.status = "FAILED";
    refund.gatewayResponse = {
      ...(refund.gatewayResponse || {}),
      error: error?.error || error?.message || String(error),
    };
    refund.rejectionReason =
      error?.error?.description ||
      error?.description ||
      error?.message ||
      "Razorpay refund failed";
    await refund.save();

    await writeAuditLog({
      actorId: adminId,
      action: "REFUND_FAILED",
      resourceType: "REFUND",
      resourceId: refund._id,
      details: {
        orderId: order._id.toString(),
        amount: refund.amount,
        reason: refund.rejectionReason,
      },
    });

    throw new AppError(
      502,
      "REFUND_GATEWAY_FAILED",
      refund.rejectionReason
    );
  }
};

export const rejectRefundService = async (adminId, refundId, reason) => {
  const refund = await Refund.findById(refundId);
  if (!refund) {
    throw new AppError(404, "REFUND_NOT_FOUND", "Refund not found");
  }

  if (!["REQUESTED", "APPROVED"].includes(refund.status)) {
    throw new AppError(
      409,
      "REFUND_NOT_REJECTABLE",
      `Refund cannot be rejected from ${refund.status} status`
    );
  }

  refund.status = "REJECTED";
  refund.rejectionReason = reason;
  refund.processedBy = adminId;
  refund.processedAt = new Date();
  await refund.save();

  await writeAuditLog({
    actorId: adminId,
    action: "REFUND_REJECTED",
    resourceType: "REFUND",
    resourceId: refund._id,
    details: {
      orderId: refund.orderId.toString(),
      amount: refund.amount,
      reason,
    },
  });

  await notifyCustomer(
    refund,
    "Refund request rejected",
    `Your refund request was rejected: ${reason}`,
    adminId
  );

  return refund;
};

export const completeManualRefundService = async (
  adminId,
  refundId,
  reference
) => {
  const refund = await Refund.findById(refundId);
  if (!refund) {
    throw new AppError(404, "REFUND_NOT_FOUND", "Refund not found");
  }

  if (refund.status !== "MANUAL_REQUIRED") {
    throw new AppError(
      409,
      "MANUAL_REFUND_NOT_REQUIRED",
      "This refund is not awaiting manual settlement"
    );
  }

  refund.status = "PROCESSED";
  refund.manualReference = reference;
  refund.processedBy = adminId;
  refund.processedAt = new Date();
  await refund.save();

  await syncOrderRefundStatus(refund.orderId, adminId);

  await writeAuditLog({
    actorId: adminId,
    action: "REFUND_MANUAL_PROCESSED",
    resourceType: "REFUND",
    resourceId: refund._id,
    details: {
      orderId: refund.orderId.toString(),
      amount: refund.amount,
      reference,
    },
  });

  await notifyCustomer(
    refund,
    "Refund completed",
    `Your ₹${refund.amount.toFixed(2)} refund has been completed.`,
    adminId
  );

  return refund;
};

export const handleRazorpayRefundWebhookService = async (payload) => {
  const event = payload?.event;
  const entity = payload?.payload?.refund?.entity;

  if (!entity?.id) {
    return { ignored: true };
  }

  const refund = await Refund.findOne({
    razorpayRefundId: entity.id,
  });

  if (!refund) {
    return { ignored: true };
  }

  const statusMap = {
    "refund.created": "PROCESSING",
    "refund.processed": "PROCESSED",
    "refund.failed": "FAILED",
    "refund.speed_changed": "PROCESSING",
  };

  const nextStatus = statusMap[event];
  if (!nextStatus) {
    return { ignored: true };
  }

  refund.status = nextStatus;
  refund.gatewayResponse = entity;
  if (entity.status === "failed") {
    refund.rejectionReason =
      entity.error_description ||
      entity.error_reason ||
      refund.rejectionReason;
  }
  if (nextStatus === "PROCESSED") {
    refund.processedAt = refund.processedAt || new Date();
  }
  await refund.save();

  if (nextStatus === "PROCESSED") {
    await syncOrderRefundStatus(refund.orderId);
  }

  await notifyCustomer(
    refund,
    nextStatus === "PROCESSED"
      ? "Refund processed"
      : nextStatus === "FAILED"
        ? "Refund failed"
        : "Refund update",
    nextStatus === "PROCESSED"
      ? `Your ₹${refund.amount.toFixed(2)} refund has been processed.`
      : nextStatus === "FAILED"
        ? `Your refund could not be processed. ${refund.rejectionReason || ""}`.trim()
        : `Your refund status is now ${nextStatus.toLowerCase()}.`
  );

  return { ignored: false, refund };
};

export const verifyRazorpayWebhookSignature = (rawBody, signature) => {
  if (!rawBody || !signature || !process.env.RAZORPAY_WEBHOOK_SECRET) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(String(signature));

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
};
