import crypto from "crypto";
import Delivery from "./delivery.model.js";
import Order from "../order/order.model.js";
import User from "../user/user.model.js";
import Profile from "../profile/profile.model.js";
import { uploadImage } from "../../config/cloudinary.js";
import AppError from "../../utils/AppError.js";
import { emitDeliveryUpdated, emitOrderUpdated } from "../../socket/emitters.js";
import { sendNotificationService } from "../notification/notification.service.js";

const OTP_LENGTH = 6;
const OTP_TTL_MINUTES = 30;
const MAX_OTP_ATTEMPTS = 5;
const DEFAULT_HIGH_VALUE_AMOUNT = 1000;

export const isDeliveryProofRequired = (order) => {
  const threshold = Number(process.env.DELIVERY_OTP_HIGH_VALUE_AMOUNT ?? DEFAULT_HIGH_VALUE_AMOUNT);
  const highValue = Number(order?.grandTotal ?? 0) >= threshold;
  const cod = String(order?.paymentMethod ?? "").toUpperCase() === "COD";
  return cod || highValue;
};

const generateOtp = () => crypto.randomInt(100000, 1000000).toString();

const getPopulatedDelivery = async (id) =>
  Delivery.findById(id)
    .populate({
      path: "orderId",
      populate: [
        { path: "addressId" },
        { path: "userId", select: "name email phone" },
      ],
    })
    .populate("riderId", "name email phone profileImage role portal");

export const ensureDeliveryOtpService = async (deliveryId) => {
  const delivery = await Delivery.findById(deliveryId).select("+deliveryOtp");
  if (!delivery) throw new AppError(404, "DELIVERY_NOT_FOUND", "Delivery not found");

  const order = await Order.findById(delivery.orderId);
  if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");

  if (!isDeliveryProofRequired(order)) return null;

  const now = Date.now();
  const validExisting =
    delivery.deliveryOtp &&
    delivery.deliveryOtpExpiresAt &&
    new Date(delivery.deliveryOtpExpiresAt).getTime() > now &&
    !delivery.deliveryOtpVerified;

  if (validExisting) return delivery.deliveryOtp;

  const otp = generateOtp();
  delivery.deliveryOtp = otp;
  delivery.deliveryOtpExpiresAt = new Date(now + OTP_TTL_MINUTES * 60 * 1000);
  delivery.deliveryOtpAttempts = 0;
  delivery.deliveryOtpVerified = false;
  delivery.deliveryOtpVerifiedAt = null;
  delivery.customerConfirmedAt = null;
  await delivery.save();

  return otp;
};

export const getCustomerDeliveryOtpService = async (orderId, customerId) => {
  const order = await Order.findOne({ _id: orderId, userId: customerId, isDeleted: false });
  if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");

  const delivery = await Delivery.findOne({ orderId: order._id }).select(
    "+deliveryOtp"
  );
  if (!delivery) throw new AppError(404, "DELIVERY_NOT_FOUND", "Delivery not found");

  if (!isDeliveryProofRequired(order)) {
    return {
      required: false,
      available: false,
      verified: Boolean(delivery.deliveryOtpVerified),
      otp: null,
      expiresAt: null,
      customerConfirmedAt: delivery.customerConfirmedAt,
    };
  }

  if (delivery.deliveryOtpVerified) {
    return {
      required: true,
      available: false,
      verified: true,
      otp: null,
      expiresAt: null,
      customerConfirmedAt: delivery.customerConfirmedAt,
    };
  }

  const otp = await ensureDeliveryOtpService(delivery._id);
  const refreshed = await Delivery.findById(delivery._id).select("+deliveryOtp");

  return {
    required: true,
    available: true,
    verified: false,
    otp,
    expiresAt: refreshed?.deliveryOtpExpiresAt ?? null,
    customerConfirmedAt: refreshed?.customerConfirmedAt ?? null,
  };
};

export const verifyDeliveryOtpService = async (deliveryId, riderId, otp) => {
  const delivery = await Delivery.findById(deliveryId).select("+deliveryOtp");
  if (!delivery) throw new AppError(404, "DELIVERY_NOT_FOUND", "Delivery not found");

  if (!delivery.riderId || String(delivery.riderId) !== String(riderId)) {
    throw new AppError(403, "DELIVERY_NOT_ASSIGNED", "This delivery is not assigned to you");
  }

  if (delivery.status !== "OUT_FOR_DELIVERY") {
    throw new AppError(409, "INVALID_DELIVERY_STATE", "OTP can be verified only when the order is out for delivery");
  }

  const order = await Order.findById(delivery.orderId);
  if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");

  if (!isDeliveryProofRequired(order)) {
    throw new AppError(409, "OTP_NOT_REQUIRED", "Delivery OTP is not required for this order");
  }

  if (delivery.deliveryOtpVerified) {
    return await getPopulatedDelivery(delivery._id);
  }

  if (!delivery.deliveryOtp || !delivery.deliveryOtpExpiresAt) {
    await ensureDeliveryOtpService(delivery._id);
    throw new AppError(409, "OTP_REISSUED", "A new delivery OTP was generated. Ask the customer for the current OTP.");
  }

  if (new Date(delivery.deliveryOtpExpiresAt).getTime() <= Date.now()) {
    await ensureDeliveryOtpService(delivery._id);
    throw new AppError(410, "OTP_EXPIRED", "Delivery OTP expired. Ask the customer for the new OTP.");
  }

  if (delivery.deliveryOtpAttempts >= MAX_OTP_ATTEMPTS) {
    throw new AppError(429, "OTP_ATTEMPTS_EXCEEDED", "Too many incorrect OTP attempts");
  }

  if (!/^\d{6}$/.test(String(otp ?? ""))) {
    throw new AppError(400, "INVALID_OTP", "Enter the 6-digit delivery OTP");
  }

  delivery.deliveryOtpAttempts += 1;

  if (String(delivery.deliveryOtp) !== String(otp)) {
    await delivery.save();
    throw new AppError(400, "INVALID_OTP", "Incorrect delivery OTP");
  }

  delivery.deliveryOtpVerified = true;
  delivery.deliveryOtpVerifiedAt = new Date();
  delivery.deliveryOtp = null;
  delivery.deliveryOtpExpiresAt = null;
  delivery.updatedBy = riderId;
  await delivery.save();

  emitDeliveryUpdated(delivery._id, {
    deliveryId: delivery._id,
    orderId: order._id,
    deliveryOtpVerified: true,
    deliveryOtpVerifiedAt: delivery.deliveryOtpVerifiedAt,
    updatedAt: delivery.updatedAt,
  });

  try {
    await sendNotificationService({
      userId: order.userId,
      title: "Delivery OTP verified",
      message: `Your delivery OTP for order ${order.orderNumber} was verified.`,
      type: "DELIVERY_OTP_VERIFIED",
      channel: "IN_APP",
      metadata: {
        orderId: order._id.toString(),
        deliveryId: delivery._id.toString(),
      },
      createdBy: riderId,
    });
  } catch (error) {
    console.error("Delivery OTP notification failed:", error.message);
  }

  return await getPopulatedDelivery(delivery._id);
};

export const customerConfirmDeliveryService = async (deliveryId, customerId) => {
  const delivery = await Delivery.findById(deliveryId);
  if (!delivery) throw new AppError(404, "DELIVERY_NOT_FOUND", "Delivery not found");

  const order = await Order.findOne({
    _id: delivery.orderId,
    userId: customerId,
    isDeleted: false,
  });
  if (!order) throw new AppError(403, "FORBIDDEN", "This delivery does not belong to you");

  if (!delivery.deliveryOtpVerified) {
    throw new AppError(409, "OTP_REQUIRED", "The delivery OTP must be verified at the door first");
  }

  if (delivery.customerConfirmedAt) {
    return await getPopulatedDelivery(delivery._id);
  }

  delivery.customerConfirmedAt = new Date();
  delivery.updatedBy = customerId;
  await delivery.save();

  emitDeliveryUpdated(delivery._id, {
    deliveryId: delivery._id,
    orderId: order._id,
    customerConfirmedAt: delivery.customerConfirmedAt,
    updatedAt: delivery.updatedAt,
  });

  return await getPopulatedDelivery(delivery._id);
};

export const uploadDeliveryProofService = async (
  deliveryId,
  riderId,
  userRole,
  type,
  buffer
) => {
  if (userRole !== "PARTNER") {
    throw new AppError(403, "FORBIDDEN", "Only the assigned delivery partner can upload delivery proof");
  }

  if (!buffer) throw new AppError(400, "IMAGE_REQUIRED", "Proof image is required");

  const proofType = String(type ?? "").toUpperCase();
  if (!["PHOTO", "SIGNATURE"].includes(proofType)) {
    throw new AppError(400, "INVALID_PROOF_TYPE", "Proof type must be PHOTO or SIGNATURE");
  }

  const delivery = await Delivery.findById(deliveryId);
  if (!delivery) throw new AppError(404, "DELIVERY_NOT_FOUND", "Delivery not found");

  if (!delivery.riderId || String(delivery.riderId) !== String(riderId)) {
    throw new AppError(403, "DELIVERY_NOT_ASSIGNED", "This delivery is not assigned to you");
  }

  if (!["OUT_FOR_DELIVERY", "DELIVERED"].includes(delivery.status)) {
    throw new AppError(409, "INVALID_DELIVERY_STATE", "Delivery proof can be uploaded at the door or after delivery");
  }

  const result = await uploadImage(buffer, `fresh15/delivery-proof/${delivery._id}`);
  const uploadedAt = new Date();

  if (proofType === "PHOTO") {
    delivery.proofOfDelivery.photoUrl = result.secure_url;
  } else {
    delivery.proofOfDelivery.signatureUrl = result.secure_url;
  }

  delivery.proofOfDelivery.uploadedAt = uploadedAt;
  delivery.proofOfDelivery.uploadedBy = riderId;
  delivery.updatedBy = riderId;
  await delivery.save();

  emitDeliveryUpdated(delivery._id, {
    deliveryId: delivery._id,
    orderId: delivery.orderId,
    proofOfDelivery: delivery.proofOfDelivery,
    updatedAt: delivery.updatedAt,
  });

  return {
    type: proofType,
    url: result.secure_url,
    uploadedAt,
    proofOfDelivery: delivery.proofOfDelivery,
  };
};

export const failDeliveryService = async (deliveryId, riderId, reason, note = "") => {
  const allowedReasons = [
    "CUSTOMER_UNAVAILABLE",
    "CUSTOMER_REFUSED",
    "WRONG_ADDRESS",
    "PHONE_UNREACHABLE",
    "PAYMENT_ISSUE",
    "DAMAGED_ORDER",
    "SAFETY_ISSUE",
    "OTHER",
  ];

  const normalizedReason = String(reason ?? "").toUpperCase();
  if (!allowedReasons.includes(normalizedReason)) {
    throw new AppError(400, "INVALID_FAILURE_REASON", "Invalid failed delivery reason");
  }

  const delivery = await Delivery.findById(deliveryId);
  if (!delivery) throw new AppError(404, "DELIVERY_NOT_FOUND", "Delivery not found");

  if (!delivery.riderId || String(delivery.riderId) !== String(riderId)) {
    throw new AppError(403, "DELIVERY_NOT_ASSIGNED", "This delivery is not assigned to you");
  }

  if (!["ASSIGNED", "ACCEPTED", "PICKED_UP", "OUT_FOR_DELIVERY"].includes(delivery.status)) {
    throw new AppError(409, "INVALID_DELIVERY_STATE", "This delivery cannot be marked as failed");
  }

  const order = await Order.findById(delivery.orderId);
  if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");

  const now = new Date();
  delivery.status = "FAILED";
  delivery.failedDelivery = {
    reason: normalizedReason,
    note: String(note).trim().slice(0, 500),
    failedAt: now,
    failedBy: riderId,
  };
  delivery.riderStatus = "ONLINE";
  delivery.currentLocation = null;
  delivery.updatedBy = riderId;
  await delivery.save();

  await User.findByIdAndUpdate(riderId, { $set: { currentLocation: null } });
  await Profile.findOneAndUpdate(
    { userId: riderId },
    { $set: { currentDeliveryId: null, deliveryStatus: "AVAILABLE" } }
  );

  // Keep the order open for admin reassignment unless it was already cancelled.
  if (order.orderStatus !== "CANCELLED") {
    order.orderStatus = "CONFIRMED";
    order.deliveryPartnerId = null;
    order.updatedBy = riderId;
    await order.save();
  }

  emitOrderUpdated(order._id, {
    orderId: order._id,
    deliveryId: delivery._id,
    orderStatus: order.orderStatus,
    deliveryStatus: delivery.status,
    failedDelivery: delivery.failedDelivery,
    updatedAt: now,
  });
  emitDeliveryUpdated(delivery._id, {
    deliveryId: delivery._id,
    orderId: order._id,
    deliveryStatus: "FAILED",
    failedDelivery: delivery.failedDelivery,
    updatedAt: now,
  });

  try {
    await sendNotificationService({
      userId: order.userId,
      title: "Delivery could not be completed",
      message: `Delivery for order ${order.orderNumber} could not be completed: ${normalizedReason.replaceAll("_", " ").toLowerCase()}.`,
      type: "DELIVERY_FAILED",
      channel: "IN_APP",
      metadata: {
        orderId: order._id.toString(),
        deliveryId: delivery._id.toString(),
        reason: normalizedReason,
      },
      createdBy: riderId,
    });
  } catch (error) {
    console.error("Delivery failure notification failed:", error.message);
  }

  return await getPopulatedDelivery(delivery._id);
};