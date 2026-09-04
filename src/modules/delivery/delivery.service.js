import Delivery from "./delivery.model.js";
import Order from "../order/order.model.js";
import User from "../user/user.model.js";
import Profile from "../profile/profile.model.js";
import { parsePagination, buildPagination } from "../../utils/pagination.js";
import AppError from "../../utils/AppError.js";
import { rewardDeliveredOrderService } from "../loyalty/loyalty.service.js";
import { ensureDeliveryOtpService, isDeliveryProofRequired } from "./delivery-proof.service.js";
import { recordDeliveredOrderEarningsService } from "../partnerOps/partnerOps.service.js";
import { sendNotificationService } from "../notification/notification.service.js";
import { emitPartnerAssigned, emitOrderUpdated, emitDeliveryUpdated } from "../../socket/emitters.js";

const ACTIVE_DELIVERY_STATUSES = ["ASSIGNED", "ACCEPTED", "PICKED_UP", "OUT_FOR_DELIVERY"];
export const PARTNER_ACCEPTANCE_WINDOW_MS = 90 * 1000;

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

const buildDeliveryRealtimePayload = (delivery, order) => ({
  deliveryId: delivery._id,
  orderId: order._id,
  orderNumber: order.orderNumber,
  customerId: order.userId,
  riderId: delivery.riderId,
  deliveryStatus: delivery.status,
  orderStatus: order.orderStatus,
  riderStatus: delivery.riderStatus,
  assignedAt: delivery.assignedAt,
  acceptedAt: delivery.acceptedAt,
  pickedUpAt: delivery.pickedUpAt,
  deliveredAt: delivery.deliveredAt,
  rejectedAt: delivery.rejectedAt,
  cancelledAt: delivery.cancelledAt,
  acceptanceDeadlineAt: delivery.acceptanceDeadlineAt,
  estimatedDeliveryTime: delivery.estimatedDeliveryTime,
  currentLocation: delivery.currentLocation,
  destination: order.addressId
    ? { latitude: order.addressId.latitude, longitude: order.addressId.longitude }
    : null,
  updatedAt: delivery.updatedAt,
});

const releaseRider = async (riderId, deliveryId, { completed = false, earning = 0 } = {}) => {
  if (!riderId) return;
  const profile = await Profile.findOne({ userId: riderId });
  if (!profile || String(profile.currentDeliveryId || "") !== String(deliveryId)) return;

  profile.currentDeliveryId = null;
  profile.deliveryStatus = profile.isOnline
    ? (profile.isPaused ? "PAUSED" : "AVAILABLE")
    : "OFFLINE";

  if (completed) {
    profile.totalDeliveries = Number(profile.totalDeliveries || 0) + 1;
    profile.totalEarnings = Number(profile.totalEarnings || 0) + Number(earning || 0);
  }

  await profile.save();
};

const expireAssignedDelivery = async (delivery, now = new Date()) => {
  if (
    !delivery ||
    delivery.status !== "ASSIGNED" ||
    !delivery.acceptanceDeadlineAt ||
    new Date(delivery.acceptanceDeadlineAt) > now
  ) {
    return false;
  }

  const riderId = delivery.riderId;
  const order = await Order.findById(delivery.orderId);

  delivery.status = "EXPIRED";
  delivery.rejectedAt = now;
  delivery.riderStatus = "OFFLINE";
  delivery.acceptanceDeadlineAt = null;
  delivery.updatedBy = riderId || null;
  await delivery.save();

  await releaseRider(riderId, delivery._id);

  if (order) {
    order.orderStatus = "CONFIRMED";
    order.deliveryPartnerId = null;
    order.updatedBy = riderId || null;
    await order.save();

    emitOrderUpdated(order._id, {
      orderId: order._id,
      customerId: order.userId,
      deliveryId: delivery._id,
      deliveryStatus: "EXPIRED",
      orderStatus: order.orderStatus,
      updatedAt: now,
    });
  }

  emitDeliveryUpdated(delivery._id, {
    deliveryId: delivery._id,
    orderId: delivery.orderId,
    riderId,
    deliveryStatus: "EXPIRED",
    acceptanceDeadlineAt: null,
    updatedAt: now,
  });

  return true;
};

const expireOverdueAssignedDeliveries = async (riderId) => {
  const overdue = await Delivery.find({
    riderId,
    status: "ASSIGNED",
    acceptanceDeadlineAt: { $lte: new Date() },
  });

  for (const delivery of overdue) {
    try {
      await expireAssignedDelivery(delivery);
    } catch (error) {
      console.error("Delivery acceptance expiry processing failed:", error.message);
    }
  }
};

export const getAvailableRidersService = async () => {
  const profiles = await Profile.find({
    isOnline: true,
    deliveryStatus: "AVAILABLE",
    currentDeliveryId: null,
  })
    .select("userId isOnline deliveryStatus currentDeliveryId updatedAt")
    .sort({ updatedAt: 1 })
    .lean();

  const ids = profiles.map((profile) => profile.userId).filter(Boolean);
  if (!ids.length) return [];

  const riders = await User.find({
    _id: { $in: ids },
    role: "PARTNER",
    portal: "partner",
    isActive: { $ne: false },
  })
    .select("name email phone profileImage role portal isActive")
    .lean();

  const profileMap = new Map(
    profiles.map((profile) => [String(profile.userId), profile]),
  );

  return riders.map((rider) => ({
    ...rider,
    availableSince: profileMap.get(String(rider._id))?.updatedAt || null,
  }));
};

export const getAllDeliveriesService = async (query = {}) => {
  const pagination = parsePagination(query);
  const base = Delivery.find()
    .populate({ path: "orderId", populate: { path: "addressId" } })
    .populate("riderId", "name email phone profileImage role portal")
    .sort({ createdAt: -1 });

  if (!pagination.hasPagination) return await base;

  const [items, total] = await Promise.all([
    base.skip(pagination.skip).limit(pagination.limit),
    Delivery.countDocuments(),
  ]);

  return {
    items,
    pagination: buildPagination({
      page: pagination.page,
      limit: pagination.limit,
      total,
    }),
  };
};

export const getDeliveryByIdService = async (id, userId, userRole) => {
  const delivery = await getPopulatedDelivery(id);
  if (!delivery) throw new AppError(404, "DELIVERY_NOT_FOUND", "Delivery not found");

  if (
    userRole === "PARTNER" &&
    (!delivery.riderId ||
      String(delivery.riderId._id ?? delivery.riderId) !== String(userId))
  ) {
    throw new AppError(403, "DELIVERY_FORBIDDEN", "This delivery is not assigned to you");
  }

  return delivery;
};

export const getMyDeliveriesService = async (riderId, query = {}) => {
  await expireOverdueAssignedDeliveries(riderId);

  const pagination = parsePagination(query);
  const filter = { riderId };

  const base = Delivery.find(filter)
    .populate({ path: "orderId", populate: { path: "addressId" } })
    .populate("riderId", "name email phone profileImage role portal")
    .sort({ createdAt: -1 });

  if (!pagination.hasPagination) return await base;

  const [items, total] = await Promise.all([
    base.skip(pagination.skip).limit(pagination.limit),
    Delivery.countDocuments(filter),
  ]);

  return {
    items,
    pagination: buildPagination({
      page: pagination.page,
      limit: pagination.limit,
      total,
    }),
  };
};

export const getMyActiveDeliveryService = async (riderId) => {
  await expireOverdueAssignedDeliveries(riderId);

  return Delivery.findOne({
    riderId,
    status: { $in: ACTIVE_DELIVERY_STATUSES },
  })
    .populate({ path: "orderId", populate: { path: "addressId" } })
    .populate("riderId", "name email phone profileImage role portal")
    .sort({ assignedAt: -1 });
};

export const createDeliveryService = async (userId, body) => {
  if (!body?.orderId) {
    throw new AppError(422, "ORDER_ID_REQUIRED", "Order ID is required");
  }

  const order = await Order.findById(body.orderId).populate("addressId");
  if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");

  if (order.orderStatus === "CANCELLED") {
    throw new AppError(422, "ORDER_NOT_ASSIGNABLE", "Cannot create delivery for a cancelled order");
  }

  if (order.orderStatus === "DELIVERED") {
    throw new AppError(422, "ORDER_NOT_ASSIGNABLE", "Order is already delivered");
  }

  const existing = await Delivery.findOne({ orderId: body.orderId });
  if (existing) {
    throw new AppError(409, "DELIVERY_ALREADY_EXISTS", "Delivery already exists for this order");
  }

  const delivery = await Delivery.create({
    orderId: body.orderId,
    deliveryCharge: Number(order.deliveryCharge) || 0,
    estimatedDeliveryTime: body.estimatedDeliveryTime || null,
    notes: body.notes || "",
    createdBy: userId,
  });

  if (isDeliveryProofRequired(order)) {
    await ensureDeliveryOtpService(delivery._id);
  }

  emitDeliveryUpdated(
    delivery._id,
    buildDeliveryRealtimePayload(delivery, order),
  );

  return getPopulatedDelivery(delivery._id);
};

export const assignRiderService = async (id, riderId, userId) => {
  if (!riderId) {
    throw new AppError(422, "RIDER_REQUIRED", "Delivery partner is required");
  }

  const delivery = await Delivery.findById(id);
  if (!delivery) {
    throw new AppError(404, "DELIVERY_NOT_FOUND", "Delivery not found");
  }

  if (!["PENDING", "EXPIRED", "REJECTED", "FAILED"].includes(delivery.status)) {
    throw new AppError(409, "DELIVERY_NOT_ASSIGNABLE", "Delivery is not available for assignment");
  }

  const order = await Order.findById(delivery.orderId).populate("addressId");
  if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");

  if (["CANCELLED", "DELIVERED"].includes(order.orderStatus)) {
    throw new AppError(
      409,
      "ORDER_NOT_ASSIGNABLE",
      `Cannot assign rider to ${order.orderStatus.toLowerCase()} order`,
    );
  }

  const rider = await User.findOne({
    _id: riderId,
    role: "PARTNER",
    portal: "partner",
    isActive: { $ne: false },
  })
    .select("name email phone profileImage role portal")
    .lean();

  if (!rider) {
    throw new AppError(
      404,
      "PARTNER_NOT_FOUND",
      "Selected user is not an active delivery partner",
    );
  }

  const now = new Date();

  const claimedProfile = await Profile.findOneAndUpdate(
    {
      userId: riderId,
      isOnline: true,
      isPaused: { $ne: true },
      deliveryStatus: "AVAILABLE",
      currentDeliveryId: null,
    },
    {
      $set: {
        deliveryStatus: "BUSY",
        currentDeliveryId: delivery._id,
      },
    },
    { new: true },
  );

  if (!claimedProfile) {
    throw new AppError(
      409,
      "RIDER_ALREADY_ALLOCATED",
      "Delivery partner is no longer available. Refresh the rider list and try again.",
    );
  }

  const conflicting = await Delivery.findOne({
    riderId,
    status: { $in: ACTIVE_DELIVERY_STATUSES },
    _id: { $ne: delivery._id },
  })
    .select("_id")
    .lean();

  if (conflicting) {
    await Profile.updateOne(
      { _id: claimedProfile._id, currentDeliveryId: delivery._id },
      {
        $set: {
          currentDeliveryId: null,
          deliveryStatus: "AVAILABLE",
        },
      },
    );
    throw new AppError(
      409,
      "RIDER_ALREADY_ALLOCATED",
      "Delivery partner is already handling another active delivery.",
    );
  }

  const updated = await Delivery.findOneAndUpdate(
    {
      _id: delivery._id,
      status: { $in: ["PENDING", "EXPIRED", "REJECTED", "FAILED"] },
    },
    {
      $set: {
        riderId,
        status: "ASSIGNED",
        assignedAt: now,
        acceptanceDeadlineAt: new Date(
          now.getTime() + PARTNER_ACCEPTANCE_WINDOW_MS,
        ),
        rejectedAt: null,
        riderStatus: "BUSY",
        currentLocation: null,
        updatedBy: userId,
      },
    },
    { new: true },
  );

  if (!updated) {
    await Profile.updateOne(
      { _id: claimedProfile._id, currentDeliveryId: delivery._id },
      {
        $set: {
          currentDeliveryId: null,
          deliveryStatus: "AVAILABLE",
        },
      },
    );

    throw new AppError(
      409,
      "DELIVERY_ASSIGNMENT_CONFLICT",
      "Delivery was changed by another admin. Refresh the order and try again.",
    );
  }

  const orderUpdated = await Order.findOneAndUpdate(
    {
      _id: order._id,
      orderStatus: { $nin: ["CANCELLED", "DELIVERED"] },
    },
    {
      $set: {
        orderStatus: "CONFIRMED",
        deliveryPartnerId: riderId,
        updatedBy: userId,
      },
    },
    { new: true },
  );

  if (!orderUpdated) {
    await Delivery.findOneAndUpdate(
      { _id: updated._id, riderId, status: "ASSIGNED" },
      {
        $set: {
          riderId: null,
          status: "PENDING",
          acceptanceDeadlineAt: null,
          riderStatus: "OFFLINE",
          updatedBy: userId,
        },
      },
    );

    await Profile.updateOne(
      { _id: claimedProfile._id, currentDeliveryId: delivery._id },
      {
        $set: {
          currentDeliveryId: null,
          deliveryStatus: "AVAILABLE",
        },
      },
    );

    throw new AppError(
      409,
      "ORDER_STATE_CHANGED",
      "Order state changed while assigning. Refresh and try again.",
    );
  }

  const assignmentPayload = {
    deliveryId: updated._id,
    orderId: orderUpdated._id,
    customerId: orderUpdated.userId,
    riderId,
    orderNumber: orderUpdated.orderNumber,
    deliveryStatus: updated.status,
    orderStatus: orderUpdated.orderStatus,
    assignedAt: updated.assignedAt,
    acceptanceDeadlineAt: updated.acceptanceDeadlineAt,
    destination: orderUpdated.addressId
      ? {
          latitude: orderUpdated.addressId.latitude,
          longitude: orderUpdated.addressId.longitude,
        }
      : null,
  };

  emitPartnerAssigned(riderId, assignmentPayload);
  emitDeliveryUpdated(updated._id, assignmentPayload);

  try {
    await sendNotificationService({
      userId: riderId,
      title: "New delivery assigned",
      message: `A new delivery has been assigned to you for order ${orderUpdated.orderNumber}.`,
      type: "RIDER_ASSIGNED",
      channel: "IN_APP",
      metadata: {
        deliveryId: updated._id.toString(),
        orderId: orderUpdated._id.toString(),
        orderNumber: orderUpdated.orderNumber,
      },
      createdBy: userId,
    });
  } catch (error) {
    console.error("Rider assignment notification failed:", error.message);
  }

  try {
    await sendNotificationService({
      userId: orderUpdated.userId,
      title: "Delivery partner assigned",
      message: `A delivery partner has been assigned to order ${orderUpdated.orderNumber}.`,
      type: "RIDER_ASSIGNED",
      channel: "IN_APP",
      metadata: {
        deliveryId: updated._id.toString(),
        orderId: orderUpdated._id.toString(),
        orderNumber: orderUpdated.orderNumber,
        riderId: rider._id.toString(),
      },
      createdBy: userId,
    });
  } catch (error) {
    console.error("Customer assignment notification failed:", error.message);
  }

  return getPopulatedDelivery(updated._id);
};

export const updateDeliveryStatusService = async (
  id,
  status,
  userId,
  userRole,
) => {
  const delivery = await Delivery.findById(id);
  if (!delivery) throw new AppError(404, "DELIVERY_NOT_FOUND", "Delivery not found");

  if (userRole === "PARTNER") {
    if (!delivery.riderId || String(delivery.riderId) !== String(userId)) {
      throw new AppError(403, "DELIVERY_FORBIDDEN", "This delivery is not assigned to you");
    }
  }

  const nextStatus = String(status || "").toUpperCase();
  const allowedStatuses = [
    "ACCEPTED",
    "PICKED_UP",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "REJECTED",
    "CANCELLED",
  ];

  if (!allowedStatuses.includes(nextStatus)) {
    throw new AppError(422, "INVALID_DELIVERY_STATUS", "Invalid delivery status");
  }

  if (["DELIVERED", "CANCELLED"].includes(delivery.status)) {
    throw new AppError(
      409,
      "INVALID_DELIVERY_TRANSITION",
      `${delivery.status.toLowerCase()} delivery cannot be modified`,
    );
  }

  const order = await Order.findById(delivery.orderId).populate("addressId");
  if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");

  const now = new Date();

  if (
    nextStatus === "ACCEPTED" &&
    delivery.status === "ASSIGNED" &&
    delivery.acceptanceDeadlineAt &&
    new Date(delivery.acceptanceDeadlineAt) <= now
  ) {
    await expireAssignedDelivery(delivery, now);
    throw new AppError(
      409,
      "DELIVERY_ACCEPTANCE_EXPIRED",
      "The acceptance window has expired. The delivery has been released for reassignment.",
    );
  }

  if (nextStatus === "DELIVERED" && isDeliveryProofRequired(order)) {
    if (!delivery.deliveryOtpVerified) {
      throw new AppError(
        409,
        "DELIVERY_OTP_REQUIRED",
        "Delivery OTP must be verified before completing this delivery",
      );
    }
    if (!delivery.customerConfirmedAt) {
      throw new AppError(
        409,
        "CUSTOMER_CONFIRMATION_REQUIRED",
        "Customer confirmation is required before completing this delivery",
      );
    }
  }

  switch (nextStatus) {
    case "ACCEPTED":
      if (delivery.status !== "ASSIGNED") {
        throw new AppError(409, "INVALID_DELIVERY_TRANSITION", "Delivery must be assigned first");
      }
      if (!delivery.riderId) {
        throw new AppError(409, "RIDER_REQUIRED", "Delivery partner is not assigned");
      }
      delivery.acceptedAt = now;
      delivery.acceptanceDeadlineAt = null;
      delivery.riderStatus = "BUSY";
      break;

    case "PICKED_UP":
      if (delivery.status !== "ACCEPTED") {
        throw new AppError(409, "INVALID_DELIVERY_TRANSITION", "Delivery must be accepted first");
      }
      delivery.pickedUpAt = now;
      delivery.riderStatus = "BUSY";
      break;

    case "OUT_FOR_DELIVERY":
      if (delivery.status !== "PICKED_UP") {
        throw new AppError(409, "INVALID_DELIVERY_TRANSITION", "Order must be picked up first");
      }
      delivery.riderStatus = "BUSY";
      break;

    case "DELIVERED":
      if (delivery.status !== "OUT_FOR_DELIVERY") {
        throw new AppError(409, "INVALID_DELIVERY_TRANSITION", "Delivery must be out for delivery first");
      }
      delivery.deliveredAt = now;
      delivery.earning = Number(delivery.deliveryCharge) || 0;
      delivery.riderStatus = "ONLINE";
      delivery.currentLocation = null;
      await releaseRider(delivery.riderId, delivery._id, {
        completed: true,
        earning: delivery.earning,
      });
      order.orderStatus = "DELIVERED";
      order.updatedBy = userId;
      await order.save();
      break;

    case "REJECTED": {
      if (delivery.status !== "ASSIGNED") {
        throw new AppError(409, "INVALID_DELIVERY_TRANSITION", "Only an assigned delivery can be rejected");
      }
      const rejectedRiderId = delivery.riderId;
      delivery.rejectedAt = now;
      await releaseRider(rejectedRiderId, delivery._id);
      delivery.riderId = null;
      delivery.status = "PENDING";
      delivery.riderStatus = "OFFLINE";
      delivery.acceptanceDeadlineAt = null;
      delivery.currentLocation = null;
      delivery.updatedBy = userId;
      await delivery.save();
      order.deliveryPartnerId = null;
      order.orderStatus = "CONFIRMED";
      order.updatedBy = userId;
      await order.save();
      emitDeliveryUpdated(delivery._id, buildDeliveryRealtimePayload(delivery, order));
      return getPopulatedDelivery(delivery._id);
    }

    case "CANCELLED":
      delivery.cancelledAt = now;
      delivery.riderStatus = "OFFLINE";
      await releaseRider(delivery.riderId, delivery._id);
      delivery.riderId = null;
      delivery.acceptanceDeadlineAt = null;
      delivery.currentLocation = null;
      order.deliveryPartnerId = null;
      order.orderStatus = "CANCELLED";
      order.updatedBy = userId;
      await order.save();
      break;
  }

  delivery.status = nextStatus;
  delivery.updatedBy = userId;
  await delivery.save();

  if (nextStatus === "DELIVERED") {
    try {
      await rewardDeliveredOrderService(order._id, order.userId);
    } catch (error) {
      console.error("Loyalty reward failed:", error.message);
    }
    try {
      await recordDeliveredOrderEarningsService(
        delivery.riderId,
        order._id,
        delivery._id,
        delivery.earning,
      );
    } catch (error) {
      console.error("Partner earnings failed:", error.message);
    }
  }

  const payload = buildDeliveryRealtimePayload(delivery, order);
  emitDeliveryUpdated(delivery._id, payload);
  emitOrderUpdated(order._id, payload);

  return getPopulatedDelivery(delivery._id);
};

export const deleteDeliveryService = async (id) => {
  const delivery = await Delivery.findById(id);
  if (!delivery) throw new AppError(404, "DELIVERY_NOT_FOUND", "Delivery not found");

  if (ACTIVE_DELIVERY_STATUSES.includes(delivery.status)) {
    throw new AppError(409, "DELIVERY_ACTIVE", "Active delivery cannot be deleted");
  }

  await releaseRider(delivery.riderId, delivery._id);
  await Delivery.deleteOne({ _id: id });
  return null;
};

export const getCustomerDeliveryByOrderService = async (orderId, userId) => {
  const order = await Order.findOne({ _id: orderId, userId }).select("_id");
  if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");

  return getPopulatedDeliveryByOrder(orderId);
};

export const getDeliveryRouteService = async (id, userId, userRole) => {
  const delivery = await getDeliveryByIdService(id, userId, userRole);
  const order = delivery.orderId;
  const destination = order?.addressId
    ? {
        latitude: order.addressId.latitude,
        longitude: order.addressId.longitude,
      }
    : null;

  return {
    deliveryId: delivery._id,
    orderId: order?._id ?? null,
    currentLocation: delivery.currentLocation ?? null,
    destination,
  };
};

const getPopulatedDeliveryByOrder = async (orderId) =>
  Delivery.findOne({ orderId })
    .populate({ path: "orderId", populate: [{ path: "addressId" }, { path: "userId", select: "name email phone" }] })
    .populate("riderId", "name email phone profileImage role portal");

export const updateDeliveryLocationService = async (
  id,
  riderId,
  location,
) => {
  const delivery = await Delivery.findById(id);
  if (!delivery) throw new AppError(404, "DELIVERY_NOT_FOUND", "Delivery not found");
  if (String(delivery.riderId) !== String(riderId)) {
    throw new AppError(403, "DELIVERY_FORBIDDEN", "This delivery is not assigned to you");
  }

  if (!["ACCEPTED", "PICKED_UP", "OUT_FOR_DELIVERY"].includes(delivery.status)) {
    throw new AppError(409, "DELIVERY_NOT_ACTIVE", "Location can only be updated for an active delivery");
  }

  delivery.currentLocation = {
    latitude: Number(location?.latitude),
    longitude: Number(location?.longitude),
    accuracy: Number.isFinite(Number(location?.accuracy)) ? Number(location.accuracy) : null,
    speed: Number.isFinite(Number(location?.speed)) ? Number(location.speed) : null,
    heading: Number.isFinite(Number(location?.heading)) ? Number(location.heading) : null,
    updatedAt: new Date(),
  };

  await delivery.save();
  emitDeliveryUpdated(delivery._id, {
    deliveryId: delivery._id,
    riderId,
    deliveryStatus: delivery.status,
    currentLocation: delivery.currentLocation,
    updatedAt: delivery.updatedAt,
  });

  return delivery;
};
