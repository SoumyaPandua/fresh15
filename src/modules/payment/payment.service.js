import crypto from "crypto";
import Razorpay from "razorpay";

import Payment from "./payment.model.js";
import Order from "../order/order.model.js";
import { sendNotificationService } from "../notification/notification.service.js";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export const createPaymentOrderService = async (
  userId,
  orderId
) => {
  const order = await Order.findOne({
    _id: orderId,
    userId,
  });

  if (!order) {
    throw new Error("Order not found");
  }

  if (order.paymentStatus === "PAID") {
    throw new Error("Order already paid");
  }

  let payment = await Payment.findOne({
    orderId,
  });

  if (payment && payment.status === "PAID") {
    throw new Error("Payment already completed");
  }

  const razorpayOrder = await razorpay.orders.create({
    amount: Math.round(order.grandTotal * 100),
    currency: "INR",
    receipt: order.orderNumber,
  });

  if (!payment) {
    payment = await Payment.create({
      orderId: order._id,
      userId,
      razorpayOrderId: razorpayOrder.id,
      amount: order.grandTotal,
      currency: "INR",
      method: order.paymentMethod,
      status: "CREATED",
      createdBy: userId,
    });
  } else {
    payment.razorpayOrderId = razorpayOrder.id;
    payment.amount = order.grandTotal;
    payment.status = "CREATED";
    payment.updatedBy = userId;

    await payment.save();
  }

  return {
    key: process.env.RAZORPAY_KEY_ID,
    orderId: razorpayOrder.id,
    amount: razorpayOrder.amount,
    currency: razorpayOrder.currency,
    receipt: razorpayOrder.receipt,
  };
};

export const verifyPaymentService = async (
  userId,
  body
) => {
  const order = await Order.findOne({
    _id: body.orderId,
    userId,
  });

  if (!order) {
    throw new Error("Order not found");
  }

  const payment = await Payment.findOne({
    orderId: order._id,
  });

  if (!payment) {
    throw new Error("Payment not found");
  }

  const generatedSignature = crypto
    .createHmac(
      "sha256",
      process.env.RAZORPAY_KEY_SECRET
    )
    .update(
      `${body.razorpay_order_id}|${body.razorpay_payment_id}`
    )
    .digest("hex");

  if (
    generatedSignature !==
    body.razorpay_signature
  ) {
    payment.status = "FAILED";
    payment.failureReason = "Signature verification failed";
    payment.updatedBy = userId;

    await payment.save();

    throw new Error("Invalid payment signature");
  }

  payment.razorpayPaymentId =
    body.razorpay_payment_id;

  payment.razorpaySignature =
    body.razorpay_signature;

  payment.gatewayResponse = body;

  payment.status = "PAID";

  payment.paidAt = new Date();

  payment.updatedBy = userId;

  await payment.save();

  order.paymentStatus = "PAID";

  order.orderStatus = "CONFIRMED";

  await order.save();

  try {
    await sendNotificationService({
      userId: order.userId,
      title: "Payment successful",
      message: `Payment for order ${order.orderNumber} was successful.`,
      type: "PAYMENT_SUCCESS",
      channel: "IN_APP",
      metadata: {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        paymentMethod: "ONLINE",
      },
      createdBy: userId,
    });
  } catch (error) {
    console.error(
      "Payment success notification failed:",
      error.message
    );
  }

  return payment;
};

export const paymentFailureService = async (
  userId,
  body
) => {
  const order = await Order.findOne({
    _id: body.orderId,
    userId,
  });

  if (!order) {
    throw new Error("Order not found");
  }

  const payment = await Payment.findOne({
    orderId: order._id,
    userId,
  });

  if (!payment) {
    throw new Error("Payment not found");
  }

  payment.status = "FAILED";
  payment.failureReason =
    body.reason || "Payment failed";
  payment.updatedBy = userId;

  await payment.save();

  try {
    await sendNotificationService({
      userId: order.userId,
      title: "Payment failed",
      message: `Payment for order ${order.orderNumber} could not be completed.`,
      type: "PAYMENT_FAILED",
      channel: "IN_APP",
      metadata: {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
      },
      createdBy: userId,
    });
  } catch (error) {
    console.error(
      "Payment failure notification failed:",
      error.message
    );
  }

  return payment;
};

export const getPaymentByOrderService = async (
  orderId,
  userId
) => {
  const payment = await Payment.findOne({
    orderId,
    userId,
  })
    .populate("orderId")
    .populate("userId", "name email phone");

  if (!payment) {
    throw new Error("Payment not found");
  }

  return payment;
};