import { io } from "../server.js";

import {
  adminRoom,
  customerRoom,
  partnerRoom,
  orderRoom,
} from "./rooms.js";

// ==============================
// NEW ORDER
// ==============================
export const emitNewOrder = (order) => {
  io.to(adminRoom()).emit("order:new", order);

  console.log(
    `📦 New order emitted: ${order.orderNumber}`
  );
};

// ==============================
// ORDER UPDATED
// ==============================
export const emitOrderUpdated = (
  orderId,
  payload = {}
) => {
  const eventPayload = {
    orderId,
    ...payload,
    updatedAt:
      payload.updatedAt || new Date(),
  };

  io.to(orderRoom(orderId)).emit(
    "order:updated",
    eventPayload
  );

  io.to(adminRoom()).emit(
    "order:updated",
    eventPayload
  );

  if (eventPayload.customerId) {
    io.to(
      customerRoom(eventPayload.customerId)
    ).emit(
      "order:updated",
      eventPayload
    );
  }

  if (eventPayload.riderId) {
    io.to(
      partnerRoom(eventPayload.riderId)
    ).emit(
      "order:updated",
      eventPayload
    );
  }

  console.log(
    `📢 order:updated emitted for ${orderId}`
  );
};

// ==============================
// DELIVERY UPDATED
// ==============================
export const emitDeliveryUpdated = (
  deliveryId,
  payload = {}
) => {
  const eventPayload = {
    deliveryId,
    ...payload,
    updatedAt:
      payload.updatedAt || new Date(),
  };

  io.to(adminRoom()).emit(
    "delivery:updated",
    eventPayload
  );

  if (eventPayload.orderId) {
    io.to(
      orderRoom(eventPayload.orderId)
    ).emit(
      "delivery:updated",
      eventPayload
    );
  }

  if (eventPayload.customerId) {
    io.to(
      customerRoom(eventPayload.customerId)
    ).emit(
      "delivery:updated",
      eventPayload
    );
  }

  if (eventPayload.riderId) {
    io.to(
      partnerRoom(eventPayload.riderId)
    ).emit(
      "delivery:updated",
      eventPayload
    );
  }

  console.log(
    `📦 delivery:updated emitted for ${deliveryId}`
  );
};

// ==============================
// CUSTOMER NOTIFICATION
// ==============================
export const emitCustomerNotification = (
  customerId,
  payload
) => {
  io.to(
    customerRoom(customerId)
  ).emit(
    "customer:notification",
    payload
  );
};

// ==============================
// PARTNER ASSIGNED
// ==============================
export const emitPartnerAssigned = (
  partnerId,
  payload
) => {
  io.to(
    partnerRoom(partnerId)
  ).emit(
    "partner:assigned",
    payload
  );

  if (payload.customerId) {
    io.to(
      customerRoom(payload.customerId)
    ).emit(
      "partner:assigned",
      payload
    );
  }

  io.to(adminRoom()).emit(
    "partner:assigned",
    payload
  );

  console.log(
    `🚚 Partner assigned for order ${payload.orderId}`
  );
};

// ==============================
// LIVE PARTNER LOCATION
// ==============================
export const emitPartnerLocation = (
  orderId,
  payload
) => {
  io.to(
    orderRoom(orderId)
  ).emit(
    "partner:location",
    payload
  );

  io.to(adminRoom()).emit(
    "partner:location",
    payload
  );

  console.log(
    `📍 Partner location emitted for order ${orderId}`
  );
};

// ==============================
// PARTNER ONLINE STATUS
// ==============================
export const emitPartnerOnlineStatus = (
  partnerId,
  isOnline
) => {
  io.to(adminRoom()).emit(
    "partner:status",
    {
      partnerId,
      isOnline,
      updatedAt: new Date(),
    }
  );

  console.log(
    `🟢 Partner ${partnerId} is ${
      isOnline ? "ONLINE" : "OFFLINE"
    }`
  );
};

// ==============================
// PARTNER AVAILABILITY
// ==============================
export const emitPartnerAvailability = (
  partnerId,
  payload
) => {
  io.to(adminRoom()).emit(
    "partner:availability",
    {
      partnerId,
      ...payload,
      updatedAt:
        payload.updatedAt || new Date(),
    }
  );

  io.to(
    partnerRoom(partnerId)
  ).emit(
    "partner:availability",
    {
      partnerId,
      ...payload,
      updatedAt:
        payload.updatedAt || new Date(),
    }
  );
};

// ==============================
// ACTIVE DELIVERY SNAPSHOT
// ==============================
export const emitActiveDelivery = (
  partnerId,
  payload
) => {
  io.to(
    partnerRoom(partnerId)
  ).emit(
    "delivery:active",
    payload
  );
};
