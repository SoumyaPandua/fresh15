import { io } from "../server.js";
import { adminRoom, customerRoom, partnerRoom, orderRoom } from "./rooms.js";
import { enqueueRealtimeEvent } from "../modules/outbox/outbox.service.js";

const queue = (key, eventName, payload, roomType, roomId) =>
  enqueueRealtimeEvent(key, eventName, payload, roomType, roomId).catch((error) => {
    console.error(`Realtime outbox enqueue failed (${eventName}):`, error.message);
  });

export const emitRealtimeEvent = (eventName, payload, roomType = null, roomId = null) => {
  const room = roomType && roomId
    ? ({ admin: adminRoom, customer: customerRoom, partner: partnerRoom, order: orderRoom }[roomType]?.(roomId) || null)
    : null;
  if (room) io.to(room).emit(eventName, payload);
  else io.emit(eventName, payload);
};

export const emitNewOrder = (order) => {
  void queue(`order:new:${order.orderId}`, "order:new", order, "admin", "admin");
};

export const emitOrderUpdated = (orderId, payload = {}) => {
  const eventPayload = { orderId, ...payload, updatedAt: payload.updatedAt || new Date() };
  void queue(`order:updated:${orderId}:${String(eventPayload.updatedAt)}`, "order:updated", eventPayload, "order", orderId);
  void queue(`order:updated:admin:${orderId}:${String(eventPayload.updatedAt)}`, "order:updated", eventPayload, "admin", "admin");
  if (eventPayload.customerId) void queue(`order:updated:customer:${orderId}:${String(eventPayload.updatedAt)}`, "order:updated", eventPayload, "customer", eventPayload.customerId);
  if (eventPayload.riderId) void queue(`order:updated:partner:${orderId}:${String(eventPayload.updatedAt)}`, "order:updated", eventPayload, "partner", eventPayload.riderId);
};

export const emitDeliveryUpdated = (deliveryId, payload = {}) => {
  const eventPayload = { deliveryId, ...payload, updatedAt: payload.updatedAt || new Date() };
  void queue(`delivery:updated:admin:${deliveryId}:${String(eventPayload.updatedAt)}`, "delivery:updated", eventPayload, "admin", "admin");
  if (eventPayload.orderId) void queue(`delivery:updated:order:${deliveryId}:${String(eventPayload.updatedAt)}`, "delivery:updated", eventPayload, "order", eventPayload.orderId);
  if (eventPayload.customerId) void queue(`delivery:updated:customer:${deliveryId}:${String(eventPayload.updatedAt)}`, "delivery:updated", eventPayload, "customer", eventPayload.customerId);
  if (eventPayload.riderId) void queue(`delivery:updated:partner:${deliveryId}:${String(eventPayload.updatedAt)}`, "delivery:updated", eventPayload, "partner", eventPayload.riderId);
};

export const emitCustomerNotification = (customerId, payload) =>
  void queue(`notification:${customerId}:${payload?.id || payload?._id || Date.now()}`, "customer:notification", payload, "customer", customerId);

export const emitPartnerAssigned = (partnerId, payload) => {
  void queue(`partner:assigned:partner:${payload.orderId}:${partnerId}`, "partner:assigned", payload, "partner", partnerId);
  if (payload.customerId) void queue(`partner:assigned:customer:${payload.orderId}:${payload.customerId}`, "partner:assigned", payload, "customer", payload.customerId);
  void queue(`partner:assigned:admin:${payload.orderId}:${partnerId}`, "partner:assigned", payload, "admin", "admin");
};

export const emitPartnerLocation = (orderId, payload) =>
  void queue(`partner:location:${payload.deliveryId}:${String(payload.updatedAt || Date.now())}`, "partner:location", payload, "order", orderId);

export const emitPartnerOnlineStatus = (partnerId, isOnline) =>
  void queue(`partner:status:${partnerId}:${isOnline}:${Date.now()}`, "partner:status", { partnerId, isOnline, updatedAt: new Date() }, "admin", "admin");

export const emitPartnerAvailability = (partnerId, payload) => {
  const eventPayload = { partnerId, ...payload, updatedAt: payload.updatedAt || new Date() };
  void queue(`partner:availability:${partnerId}:${String(eventPayload.updatedAt)}`, "partner:availability", eventPayload, "admin", "admin");
  void queue(`partner:availability:partner:${partnerId}:${String(eventPayload.updatedAt)}`, "partner:availability", eventPayload, "partner", partnerId);
};

export const emitActiveDelivery = (partnerId, payload) =>
  void queue(`delivery:active:${partnerId}:${payload?.deliveryId || Date.now()}`, "delivery:active", payload, "partner", partnerId);
