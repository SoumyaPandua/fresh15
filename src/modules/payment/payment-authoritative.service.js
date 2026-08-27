import crypto from "crypto";
import Razorpay from "razorpay";
import Payment from "./payment.model.js";
import Order from "../order/order.model.js";
import { finalizeOrderStockService } from "../order/order.service.js";
import { sendNotificationService } from "../notification/notification.service.js";
import AppError from "../../utils/AppError.js";

const razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });

export const verifyPaymentAuthoritatively = async (userId, body) => {
  const order = await Order.findOne({ _id: body.orderId, userId, isDeleted: false });
  if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");

  const payment = await Payment.findOne({ orderId: order._id, userId });
  if (!payment) throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment not found");
  if (order.paymentStatus === "PAID" || payment.status === "PAID") {
    throw new AppError(409, "PAYMENT_ALREADY_COMPLETED", "Payment already completed");
  }
  if (payment.razorpayOrderId !== body.razorpay_order_id) {
    throw new AppError(400, "PAYMENT_ORDER_MISMATCH", "Payment order does not match the order being paid");
  }

  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${body.razorpay_order_id}|${body.razorpay_payment_id}`)
    .digest("hex");

  const receivedSignature = Buffer.from(String(body.razorpay_signature || ""));
  const expectedSignature = Buffer.from(expected);
  if (
    receivedSignature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(expectedSignature, receivedSignature)
  ) {
    throw new AppError(400, "PAYMENT_SIGNATURE_INVALID", "Invalid payment signature");
  }

  let gatewayPayment;
  try {
    gatewayPayment = await razorpay.payments.fetch(body.razorpay_payment_id);
  } catch (error) {
    throw new AppError(502, "PAYMENT_GATEWAY_UNAVAILABLE", "Unable to verify payment with Razorpay", [error.message]);
  }

  if (
    gatewayPayment.id !== body.razorpay_payment_id ||
    gatewayPayment.order_id !== payment.razorpayOrderId ||
    Number(gatewayPayment.amount) !== Math.round(Number(order.grandTotal) * 100) ||
    String(gatewayPayment.currency || "INR").toUpperCase() !== "INR" ||
    String(gatewayPayment.status).toLowerCase() !== "captured"
  ) {
    throw new AppError(400, "PAYMENT_GATEWAY_STATE_MISMATCH", "Razorpay payment does not match this order");
  }

  payment.razorpayPaymentId = gatewayPayment.id;
  payment.razorpaySignature = body.razorpay_signature;
  payment.gatewayResponse = gatewayPayment;
  payment.status = "PAID";
  payment.paidAt = payment.paidAt || new Date();
  payment.expiresAt = null;
  payment.updatedBy = userId;
  await payment.save();

  order.paymentStatus = "PAID";
  order.orderStatus = "CONFIRMED";
  order.paymentExpiresAt = null;
  order.updatedBy = userId;
  await order.save();
  await finalizeOrderStockService(order);

  try {
    await sendNotificationService({
      userId: order.userId,
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

  return payment;
};
