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

    console.log(`📦 New order emitted: ${order.orderNumber}`);
};

// ==============================
// ORDER STATUS UPDATED
// ==============================
export const emitOrderUpdated = (orderId, payload) => {
    io.to(orderRoom(orderId)).emit(
        "order:updated",
        payload
    );

    console.log(
        `📢 order:updated emitted for ${orderId}`
    );
};

// ==============================
// CUSTOMER NOTIFICATION
// ==============================
export const emitCustomerNotification = (
    customerId,
    payload
) => {
    io.to(customerRoom(customerId)).emit(
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
    // Notify assigned partner
    io.to(partnerRoom(partnerId)).emit(
        "partner:assigned",
        payload
    );

    // Notify customer
    io.to(customerRoom(payload.customerId)).emit(
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
    io.to(orderRoom(orderId)).emit(
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