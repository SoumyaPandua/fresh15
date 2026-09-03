import crypto from "crypto";
import Razorpay from "razorpay";
import mongoose from "mongoose";
import Payment from "./payment.model.js";
import Order from "../order/order.model.js";
import Inventory from "../inventory/inventory.model.js";
import { sendNotificationService } from "../notification/notification.service.js";
import { writeAuditLog } from "../audit/audit.service.js";
import AppError from "../../utils/AppError.js";
import { withTransaction } from "../../utils/transaction.js";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const finalizeReservedInventory = async (order, session) => {
  if (!order.stockReserved || order.stockFinalized) return;
  for (const item of order.items) {
    const inventory = await Inventory.findOneAndUpdate(
      {
        productId: item.productId,
        reservedStock: { $gte: item.quantity },
        currentStock: { $gte: item.quantity },
      },
      [
        { $set: { currentStock: { $subtract: ["$currentStock", item.quantity] }, reservedStock: { $subtract: ["$reservedStock", item.quantity] } } },
        {
          $set: {
            availableStock: { $max: [0, { $subtract: ["$currentStock", "$reservedStock"] }] },
            status: {
              $cond: [
                { $eq: [{ $max: [0, { $subtract: ["$currentStock", "$reservedStock"] }] }, 0] },
                "OUT_OF_STOCK",
                {
                  $cond: [
                    { $lte: [{ $max: [0, { $subtract: ["$currentStock", "$reservedStock"] }] }, "$lowStockThreshold"] },
                    "LOW_STOCK",
                    "IN_STOCK",
                  ],
                },
              ],
            },
          },
        },
      ],
      { new: true, updatePipeline: true, session },
    );
    if (!inventory) throw new AppError(409, "INVENTORY_FINALIZATION_CONFLICT", `Unable to finalize inventory for ${item.productName}`);
  }
  order.stockReserved = false;
  order.stockFinalized = true;
  await order.save({ session });
};

const fetchOwned = async (userId, orderId, session) => {
  const orderQuery = Order.findOne({ _id: orderId, userId, isDeleted: false });
  if (session) orderQuery.session(session);
  const order = await orderQuery;
  if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");
  return order;
};

const gatewayPaymentMatches = (gatewayPayment, payment, order) =>
  gatewayPayment?.id === gatewayPayment?.id &&
  gatewayPayment?.order_id === payment.razorpayOrderId &&
  Number(gatewayPayment?.amount) === Math.round(Number(order.grandTotal) * 100) &&
  String(gatewayPayment?.currency || "INR").toUpperCase() === "INR" &&
  String(gatewayPayment?.status || "").toLowerCase() === "captured";

export const verifyPaymentAuthoritatively = async (userId, body) => {
  const order = await fetchOwned(userId, body.orderId);
  const payment = await Payment.findOne({ orderId: order._id, userId });
  if (!payment) throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment not found");

  if (order.paymentStatus === "PAID" || payment.status === "PAID") {
    return payment;
  }

  if (payment.razorpayOrderId !== body.razorpay_order_id) {
    throw new AppError(400, "PAYMENT_ORDER_MISMATCH", "Payment order does not match the order being paid");
  }

  const expected = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${payment.razorpayOrderId}|${body.razorpay_payment_id}`)
    .digest("hex");
  const received = Buffer.from(String(body.razorpay_signature || ""));
  const expectedBuffer = Buffer.from(expected);
  if (received.length !== expectedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, received)) {
    throw new AppError(400, "PAYMENT_SIGNATURE_INVALID", "Invalid payment signature");
  }

  let gatewayPayment;
  try {
    gatewayPayment = await razorpay.payments.fetch(body.razorpay_payment_id);
  } catch (error) {
    throw new AppError(502, "PAYMENT_GATEWAY_UNAVAILABLE", "Unable to verify payment with Razorpay", [error.message]);
  }

  if (!gatewayPaymentMatches(gatewayPayment, payment, order)) {
    throw new AppError(400, "PAYMENT_GATEWAY_STATE_MISMATCH", "Razorpay payment does not match this order");
  }

  const result = await withTransaction(async (session) => {
    const txOrder = await fetchOwned(userId, body.orderId, session);
    const txPaymentQuery = Payment.findOne({ orderId: txOrder._id, userId }).session(session);
    const txPayment = await txPaymentQuery;
    if (!txPayment) throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment not found");

    if (txOrder.paymentStatus === "PAID" || txPayment.status === "PAID") {
      return txPayment;
    }

    if (txPayment.razorpayOrderId !== payment.razorpayOrderId) throw new AppError(409, "PAYMENT_STATE_CONFLICT", "Payment attempt has changed");

    await finalizeReservedInventory(txOrder, session);

    txPayment.razorpayPaymentId = gatewayPayment.id;
    txPayment.razorpaySignature = body.razorpay_signature;
    txPayment.gatewayResponse = {
      razorpay_order_id: txPayment.razorpayOrderId,
      razorpay_payment_id: gatewayPayment.id,
      status: gatewayPayment.status,
      method: gatewayPayment.method,
      amount: gatewayPayment.amount,
      currency: gatewayPayment.currency,
    };
    txPayment.status = "PAID";
    txPayment.paidAt = txPayment.paidAt || new Date();
    txPayment.expiresAt = null;
    txPayment.updatedBy = userId;
    await txPayment.save({ session });

    txOrder.paymentStatus = "PAID";
    txOrder.orderStatus = "CONFIRMED";
    txOrder.paymentExpiresAt = null;
    txOrder.updatedBy = userId;
    await txOrder.save({ session });

    return txPayment;
  });

  try {
    await sendNotificationService({
      userId,
      title: "Payment successful",
      message: `Payment for order ${order.orderNumber} was successful.`,
      type: "PAYMENT_SUCCESS",
      channel: "IN_APP",
      metadata: { orderId: order._id.toString(), orderNumber: order.orderNumber, paymentMethod: "ONLINE" },
      createdBy: userId,
    });
  } catch (error) {
    console.error("Payment success notification failed:", error.message);
  }

  await writeAuditLog({
    actorId: userId,
    action: "PAYMENT_CAPTURED",
    resourceType: "Payment",
    resourceId: result._id,
    details: { orderId: order._id.toString(), razorpayPaymentId: gatewayPayment.id, amount: Number(order.grandTotal) },
  });

  return result;
};
