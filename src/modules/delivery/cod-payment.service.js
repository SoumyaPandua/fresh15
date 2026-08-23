import Delivery from "./delivery.model.js";
import Order from "../order/order.model.js";
import Payment from "../payment/payment.model.js";
import { finalizeOrderStockService } from "../order/order.service.js";
import { sendNotificationService } from "../notification/notification.service.js";
import { emitOrderUpdated, emitDeliveryUpdated } from "../../socket/emitters.js";
import AppError from "../../utils/AppError.js";
import { recordCashCollectionService } from "../partnerOps/partnerOps.service.js";

/**
 * Collect a COD payment from the customer.
 *
 * Security rules:
 * - Only the assigned PARTNER can collect the payment.
 * - The order must use COD.
 * - The delivery must be OUT_FOR_DELIVERY.
 * - The amount is always taken from the server-side order grandTotal.
 * - A COD payment cannot be collected twice.
 * - Reserved stock is finalized when COD collection succeeds.
 */
export const collectCodPaymentService = async (deliveryId, riderId, userRole) => {
  if (userRole !== "PARTNER") {
    throw new AppError(403, "FORBIDDEN", "Only the assigned delivery partner can collect COD payment");
  }

  const delivery = await Delivery.findById(deliveryId);
  if (!delivery) {
    throw new AppError(404, "DELIVERY_NOT_FOUND", "Delivery not found");
  }

  if (!delivery.riderId || String(delivery.riderId) !== String(riderId)) {
    throw new AppError(403, "DELIVERY_NOT_ASSIGNED", "This delivery is not assigned to you");
  }

  if (delivery.status !== "OUT_FOR_DELIVERY") {
    throw new AppError(
      409,
      "INVALID_DELIVERY_STATE",
      "COD payment can be collected only when the delivery is out for delivery"
    );
  }

  const order = await Order.findById(delivery.orderId);
  if (!order) {
    throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");
  }

  if (order.paymentMethod !== "COD") {
    throw new AppError(409, "PAYMENT_METHOD_CONFLICT", "This order does not use COD payment");
  }

  if (order.paymentStatus === "PAID") {
    throw new AppError(409, "PAYMENT_ALREADY_COMPLETED", "COD payment has already been collected");
  }

  if (["CANCELLED", "DELIVERED"].includes(order.orderStatus)) {
    throw new AppError(409, "ORDER_STATE_CONFLICT", "COD payment cannot be collected for this order");
  }

  const amount = Number(order.grandTotal);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new AppError(409, "INVALID_PAYMENT_AMOUNT", "Order has an invalid COD amount");
  }

  let payment = await Payment.findOne({ orderId: order._id });
  if (payment?.status === "PAID") {
    throw new AppError(409, "PAYMENT_ALREADY_COMPLETED", "COD payment has already been collected");
  }

  const paidAt = new Date();

  // Create/update the audit record as pending before finalizing stock. If stock
  // finalization fails, the order and payment remain unpaid and retryable.
  if (!payment) {
    payment = await Payment.create({
      orderId: order._id,
      userId: order.userId,
      amount,
      currency: "INR",
      method: "COD",
      status: "PENDING",
      expiresAt: null,
      gatewayResponse: {},
      createdBy: riderId,
      updatedBy: riderId,
    });
  } else {
    payment.amount = amount;
    payment.currency = "INR";
    payment.method = "COD";
    payment.status = "PENDING";
    payment.failureReason = "";
    payment.updatedBy = riderId;
    await payment.save();
  }

  // COD orders reserve stock at order creation. Finalize it only after cash is
  // collected, matching the online-payment finalization behaviour.
  await finalizeOrderStockService(order);

  order.paymentStatus = "PAID";
  order.paymentExpiresAt = null;
  order.updatedBy = riderId;
  await order.save();

  payment.status = "PAID";
  payment.paidAt = paidAt;
  payment.failureReason = "";
  payment.gatewayResponse = {
    ...(payment.gatewayResponse || {}),
    collectionMethod: "CASH",
    paymentMethod: "COD",
    collectedBy: String(riderId),
    collectedAt: paidAt.toISOString(),
  };
  payment.updatedBy = riderId;
  await payment.save();

  try {
    await recordCashCollectionService({
      partnerId: riderId,
      deliveryId: delivery._id,
      orderId: order._id,
      amount,
      createdBy: riderId,
    });
  } catch (error) {
    // Do not make a successful COD payment appear failed because the
    // reconciliation ledger is temporarily unavailable.
    console.error("Partner cash ledger write failed:", error.message);
  }

  const paymentPayload = {
    orderId: order._id,
    orderNumber: order.orderNumber,
    paymentMethod: "COD",
    paymentStatus: "PAID",
    amount,
    currency: "INR",
    collectionMethod: "CASH",
    collectedBy: riderId,
    collectedAt: paidAt,
  };

  emitOrderUpdated(order._id, paymentPayload);
  emitDeliveryUpdated(delivery._id, {
    deliveryId: delivery._id,
    orderId: order._id,
    paymentStatus: "PAID",
    paymentMethod: "COD",
    codAmount: amount,
    codCollectedAt: paidAt,
    updatedAt: new Date(),
  });

  try {
    await sendNotificationService({
      userId: order.userId,
      title: "COD payment collected",
      message: `COD payment of ₹${amount.toFixed(2)} was collected for order ${order.orderNumber}.`,
      type: "PAYMENT_SUCCESS",
      channel: "IN_APP",
      metadata: {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        paymentMethod: "COD",
        amount,
        collectionMethod: "CASH",
        collectedBy: riderId.toString(),
      },
      createdBy: riderId,
    });
  } catch (error) {
    console.error("COD payment notification failed:", error.message);
  }

  return {
    orderId: order._id,
    orderNumber: order.orderNumber,
    paymentId: payment._id,
    paymentMethod: "COD",
    paymentStatus: "PAID",
    amount,
    currency: "INR",
    collectionMethod: "CASH",
    collectedBy: riderId,
    collectedAt: paidAt,
  };
};
