import crypto from "crypto";
import Razorpay from "razorpay";
import Payment from "./payment.model.js";
import Order from "../order/order.model.js";
import { sendNotificationService } from "../notification/notification.service.js";
import { finalizeOrderStockService, releaseOrderStockService } from "../order/order.service.js";
import { releaseCouponUsageService } from "../coupon/coupon.service.js";
import Delivery from "../delivery/delivery.model.js";
import AppError from "../../utils/AppError.js";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const getOwnedOrder = async (userId, orderId) => {
  const order = await Order.findOne({ _id: orderId, userId, isDeleted: false });
  if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");
  return order;
};

export const createPaymentOrderService = async (userId, orderId) => {
  const order = await getOwnedOrder(userId, orderId);

  if (order.paymentMethod !== "ONLINE") {
    throw new AppError(409, "PAYMENT_METHOD_CONFLICT", "This order does not use online payment");
  }
  if (order.paymentStatus === "PAID") {
    throw new AppError(409, "ORDER_ALREADY_PAID", "Order already paid");
  }
  if (order.orderStatus === "CANCELLED") {
    throw new AppError(409, "ORDER_CANCELLED", "Cancelled orders cannot be paid");
  }

  let payment = await Payment.findOne({ orderId: order._id, userId });
  if (payment?.status === "PAID") {
    throw new AppError(409, "PAYMENT_ALREADY_COMPLETED", "Payment already completed");
  }

  let razorpayOrder;
  try {
    razorpayOrder = await razorpay.orders.create({
      amount: Math.round(order.grandTotal * 100),
      currency: "INR",
      receipt: order.orderNumber,
    });
  } catch (error) {
    throw new AppError(502, "PAYMENT_GATEWAY_UNAVAILABLE", "Payment gateway is unavailable", [error.message]);
  }

  if (!payment) {
    payment = await Payment.create({
      orderId: order._id,
      userId,
      razorpayOrderId: razorpayOrder.id,
      amount: order.grandTotal,
      currency: "INR",
      method: "ONLINE",
      status: "CREATED",
      createdBy: userId,
    });
  } else {
    payment.razorpayOrderId = razorpayOrder.id;
    payment.amount = order.grandTotal;
    payment.status = "CREATED";
    payment.failureReason = "";
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

export const verifyPaymentService = async (userId, body) => {
  const order = await getOwnedOrder(userId, body.orderId);
  const payment = await Payment.findOne({ orderId: order._id, userId });

  if (!payment) throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment not found");
  if (order.paymentStatus === "PAID" || payment.status === "PAID") {
    throw new AppError(409, "PAYMENT_ALREADY_COMPLETED", "Payment already completed");
  }
  if (payment.razorpayOrderId !== body.razorpay_order_id) {
    throw new AppError(400, "PAYMENT_ORDER_MISMATCH", "Payment order does not match the order being paid");
  }

  const generatedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${body.razorpay_order_id}|${body.razorpay_payment_id}`)
    .digest("hex");

  if (generatedSignature !== body.razorpay_signature) {
    payment.status = "FAILED";
    payment.failureReason = "Signature verification failed";
    payment.updatedBy = userId;
    await payment.save();

    await releaseOrderStockService(order);
    if (order.couponUsageRecorded && order.couponId) {
      await releaseCouponUsageService(order.couponId);
      order.couponUsageRecorded = false;
    }
    order.paymentStatus = "FAILED";
    order.orderStatus = "CANCELLED";
    order.updatedBy = userId;
    await order.save();

    throw new AppError(400, "PAYMENT_SIGNATURE_INVALID", "Invalid payment signature");
  }

  payment.razorpayPaymentId = body.razorpay_payment_id;
  payment.razorpaySignature = body.razorpay_signature;
  payment.gatewayResponse = {
    razorpay_order_id: body.razorpay_order_id,
    razorpay_payment_id: body.razorpay_payment_id,
  };
  payment.status = "PAID";
  payment.paidAt = new Date();
  payment.updatedBy = userId;
  await payment.save();

  order.paymentStatus = "PAID";
  order.orderStatus = "CONFIRMED";
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

export const paymentFailureService = async (userId, body) => {
  const order = await getOwnedOrder(userId, body.orderId);
  const payment = await Payment.findOne({ orderId: order._id, userId });
  if (!payment) throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment not found");

  if (payment.status === "PAID" || order.paymentStatus === "PAID") {
    throw new AppError(409, "PAYMENT_ALREADY_COMPLETED", "A successful payment cannot be marked as failed");
  }

  payment.status = "FAILED";
  payment.failureReason = body.reason?.trim() || body.error?.description || body.error?.code || "Payment failed";
  payment.gatewayResponse = body.error || payment.gatewayResponse || {};
  payment.updatedBy = userId;
  await payment.save();

  await releaseOrderStockService(order);
  if (order.couponUsageRecorded && order.couponId) {
    await releaseCouponUsageService(order.couponId);
    order.couponUsageRecorded = false;
  }
  order.paymentStatus = "FAILED";
  order.orderStatus = "CANCELLED";
  order.updatedBy = userId;
  await order.save();

  try {
    await sendNotificationService({
      userId: order.userId,
      title: "Payment failed",
      message: `Payment for order ${order.orderNumber} could not be completed.`,
      type: "PAYMENT_FAILED",
      channel: "IN_APP",
      metadata: { orderId: order._id.toString(), orderNumber: order.orderNumber },
      createdBy: userId,
    });
  } catch (error) {
    console.error("Payment failure notification failed:", error.message);
  }

  return payment;
};

export const getPaymentByOrderService = async (orderId, userId) => {
  const payment = await Payment.findOne({ orderId, userId })
    .populate("orderId")
    .populate("userId", "name email phone");
  if (!payment) throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment not found");
  return payment;
};

export const getCodReportService = async ({ page = 1, limit = 20, search = "", paymentStatus = "", from = "", to = "" }) => {
  page = Math.max(1, Number(page) || 1);
  limit = Math.min(100, Math.max(1, Number(limit) || 20));

  const filter = { paymentMethod: "COD" };

  if (paymentStatus) filter.paymentStatus = paymentStatus.toUpperCase();

  if (search) {
    filter.$or = [{ orderNumber: new RegExp(search.trim(), "i") }];
  }

  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(`${from}T00:00:00.000Z`);
    if (to) filter.createdAt.$lte = new Date(`${to}T23:59:59.999Z`);
  }

  const [orders, total, summaryOrders] = await Promise.all([
    Order.find(filter).populate("userId", "name email phone profileImage").populate("addressId", "city").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Order.countDocuments(filter),
    Order.find(filter).select("grandTotal paymentStatus").lean(),
  ]);

  const orderIds = orders.map((order) => order._id);

  const deliveries = await Delivery.find({ orderId: { $in: orderIds } }).populate("riderId", "name fullName email phone profileImage").select("orderId riderId status deliveredAt").lean();

  const deliveryMap = new Map(deliveries.map((delivery) => [String(delivery.orderId), delivery]));

  const reportOrders = orders.map((order) => {
    const delivery = deliveryMap.get(String(order._id));
    const customer = order.userId;

    return {
      id: order._id,
      orderNumber: order.orderNumber,
      customer: customer ? { id: customer._id, name: customer.name, email: customer.email, phone: customer.phone, profileImage: customer.profileImage } : null,
      amount: order.grandTotal,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      orderStatus: order.orderStatus,
      placedAt: order.createdAt,
      collectedAt: order.paymentStatus === "PAID" ? delivery?.deliveredAt || order.updatedAt : null,
      deliveryPartner: delivery?.riderId ? { id: delivery.riderId._id, name: delivery.riderId.fullName || delivery.riderId.name, phone: delivery.riderId.phone } : null,
      deliveryStatus: delivery?.status || null,
    };
  });

  const codOrders = summaryOrders.length;
  const collected = summaryOrders.filter((order) => order.paymentStatus === "PAID").reduce((sum, order) => sum + order.grandTotal, 0);
  const pending = summaryOrders.filter((order) => order.paymentStatus === "PENDING").reduce((sum, order) => sum + order.grandTotal, 0);
  const failed = summaryOrders.filter((order) => order.paymentStatus === "FAILED").reduce((sum, order) => sum + order.grandTotal, 0);

  return {
    summary: { codOrders, collected, pending, failed, averageCodTicket: codOrders ? Math.round(collected / codOrders) : 0 },
    orders: reportOrders,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

export const getRazorpayReportService = async ({ page = 1, limit = 20, search = "", paymentStatus = "", from = "", to = "" }) => {
  page = Math.max(1, Number(page) || 1);
  limit = Math.min(100, Math.max(1, Number(limit) || 20));

  const filter = { paymentMethod: { $in: ["RAZORPAY", "ONLINE"] } };

  if (paymentStatus) filter.paymentStatus = paymentStatus.toUpperCase();

  if (search) filter.$or = [{ orderNumber: new RegExp(search.trim(), "i") }];

  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(`${from}T00:00:00.000Z`);
    if (to) filter.createdAt.$lte = new Date(`${to}T23:59:59.999Z`);
  }

  const [orders, total, summaryOrders] = await Promise.all([
    Order.find(filter).populate("userId", "name email phone profileImage").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Order.countDocuments(filter),
    Order.find(filter).select("grandTotal paymentStatus paymentMethod createdAt updatedAt orderNumber").lean(),
  ]);

  const orderIds = orders.map((order) => order._id);

  const payments = await Payment.find({ orderId: { $in: orderIds } }).select("orderId razorpayOrderId razorpayPaymentId amount status currency createdAt updatedAt").lean();

  const paymentMap = new Map(payments.map((payment) => [String(payment.orderId), payment]));

  const reportOrders = orders.map((order) => {
    const payment = paymentMap.get(String(order._id));
    const customer = order.userId;

    return {
      id: order._id,
      orderNumber: order.orderNumber,
      customer: customer ? { id: customer._id, name: customer.name, email: customer.email, phone: customer.phone, profileImage: customer.profileImage } : null,
      amount: order.grandTotal,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      razorpayOrderId: payment?.razorpayOrderId || null,
      razorpayPaymentId: payment?.razorpayPaymentId || null,
      gatewayAmount: payment?.amount ?? order.grandTotal,
      currency: payment?.currency || "INR",
      gatewayStatus: payment?.status || null,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  });

  const totalTransactions = summaryOrders.length;
  const successful = summaryOrders.filter((order) => order.paymentStatus === "PAID").reduce((sum, order) => sum + Number(order.grandTotal || 0), 0);
  const pending = summaryOrders.filter((order) => order.paymentStatus === "PENDING").reduce((sum, order) => sum + Number(order.grandTotal || 0), 0);
  const failed = summaryOrders.filter((order) => order.paymentStatus === "FAILED").reduce((sum, order) => sum + Number(order.grandTotal || 0), 0);

  return {
    summary: {
      totalTransactions,
      successful,
      pending,
      failed,
      totalAmount: successful + pending + failed,
      averageTransaction: totalTransactions ? Math.round((successful + pending + failed) / totalTransactions) : 0,
    },
    orders: reportOrders,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};