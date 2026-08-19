import {
  adminRoom,
  customerRoom,
  partnerRoom,
  orderRoom,
} from "./rooms.js";

import User from "../modules/user/user.model.js";
import Order from "../modules/order/order.model.js";
import Delivery from "../modules/delivery/delivery.model.js";

import {
  emitPartnerLocation,
  emitPartnerOnlineStatus,
  emitActiveDelivery,
} from "./emitters.js";

const ACTIVE_DELIVERY_STATUSES = [
  "ASSIGNED",
  "ACCEPTED",
  "PICKED_UP",
  "OUT_FOR_DELIVERY",
];

const partnerSockets = new Map();

const getUserId = (socket) =>
  String(socket.user._id);

const addPartnerSocket = (
  partnerId,
  socketId
) => {
  const sockets =
    partnerSockets.get(partnerId) ||
    new Set();

  sockets.add(socketId);
  partnerSockets.set(
    partnerId,
    sockets
  );

  return sockets.size;
};

const removePartnerSocket = (
  partnerId,
  socketId
) => {
  const sockets =
    partnerSockets.get(partnerId);

  if (!sockets) {
    return 0;
  }

  sockets.delete(socketId);

  if (sockets.size === 0) {
    partnerSockets.delete(partnerId);
    return 0;
  }

  return sockets.size;
};

const registerSocketEvents = (io) => {
  io.on(
    "connection",
    async (socket) => {
      console.log(
        `🟢 Socket Connected: ${socket.id}`
      );

      socket.on(
        "join:admin",
        () => {
          if (
            socket.user.role !== "ADMIN" &&
            socket.user.role !== "SUPER_ADMIN"
          ) {
            console.log(
              `❌ Unauthorized admin access: ${socket.user._id}`
            );
            return;
          }

          socket.join(adminRoom());

          console.log(
            `👨‍💼 Admin ${socket.user._id} joined admin room`
          );
        }
      );

      socket.on(
        "join:customer",
        async () => {
          if (
            socket.user.role !== "CUSTOMER"
          ) {
            console.log(
              `❌ Unauthorized customer access: ${socket.user._id}`
            );
            return;
          }

          socket.join(
            customerRoom(
              socket.user._id
            )
          );

          console.log(
            `🛒 Customer ${socket.user._id} joined`
          );
        }
      );

      socket.on(
        "join:partner",
        async () => {
          if (
            socket.user.role !== "PARTNER" ||
            socket.user.portal !== "partner"
          ) {
            console.log(
              `❌ Unauthorized partner access: ${socket.user._id}`
            );
            return;
          }

          const partnerId =
            getUserId(socket);

          const count =
            addPartnerSocket(
              partnerId,
              socket.id
            );

          socket.join(
            partnerRoom(partnerId)
          );

          await User.findByIdAndUpdate(
            partnerId,
            {
              isOnline: true,
              lastSeen: new Date(),
            }
          );

          if (count === 1) {
            emitPartnerOnlineStatus(
              partnerId,
              true
            );
          }

          const activeDelivery =
            await Delivery.findOne({
              riderId:
                socket.user._id,
              status: {
                $in:
                  ACTIVE_DELIVERY_STATUSES,
              },
            })
              .populate({
                path: "orderId",
                populate: {
                  path: "addressId",
                },
              })
              .populate(
                "riderId",
                "name email phone profileImage role portal"
              );

          if (activeDelivery) {
            emitActiveDelivery(
              partnerId,
              {
                deliveryId:
                  activeDelivery._id,
                orderId:
                  activeDelivery.orderId?._id,
                orderNumber:
                  activeDelivery.orderId
                    ?.orderNumber,
                status:
                  activeDelivery.status,
                riderId:
                  partnerId,
                currentLocation:
                  activeDelivery.currentLocation,
                destination:
                  activeDelivery.orderId
                    ?.addressId
                    ? {
                        latitude:
                          activeDelivery
                            .orderId
                            .addressId
                            .latitude,
                        longitude:
                          activeDelivery
                            .orderId
                            .addressId
                            .longitude,
                      }
                    : null,
              }
            );
          }

          console.log(
            `🚚 Partner ${socket.user._id} joined`
          );
        }
      );

      socket.on(
        "join:order",
        async ({ orderId } = {}) => {
          try {
            if (!orderId) {
              return;
            }

            if (
              socket.user.role ===
              "ADMIN" ||
              socket.user.role ===
              "SUPER_ADMIN"
            ) {
              socket.join(
                orderRoom(orderId)
              );

              console.log(
                `📦 Admin joined order room: ${orderId}`
              );
              return;
            }

            if (
              socket.user.role ===
              "CUSTOMER"
            ) {
              const order =
                await Order.findOne({
                  _id: orderId,
                  userId:
                    socket.user._id,
                }).select("_id");

              if (!order) {
                console.log(
                  `❌ Customer denied order room: ${orderId}`
                );
                return;
              }

              socket.join(
                orderRoom(orderId)
              );

              console.log(
                `📦 Customer order room joined: ${orderId}`
              );
              return;
            }

            if (
              socket.user.role ===
              "PARTNER"
            ) {
              const delivery =
                await Delivery.findOne({
                  orderId,
                  riderId:
                    socket.user._id,
                  status: {
                    $in:
                      ACTIVE_DELIVERY_STATUSES,
                  },
                }).select("_id");

              if (!delivery) {
                console.log(
                  `❌ Partner denied order room: ${orderId}`
                );
                return;
              }

              socket.join(
                orderRoom(orderId)
              );

              console.log(
                `📦 Partner order room joined: ${orderId}`
              );
            }
          } catch (error) {
            console.error(
              "Join order room failed:",
              error.message
            );
          }
        }
      );

      socket.on(
        "location:update",
        async (
          {
            orderId,
            latitude,
            longitude,
            accuracy,
            speed,
            heading,
          } = {}
        ) => {
          try {
            if (
              socket.user.role !==
                "PARTNER" ||
              socket.user.portal !==
                "partner"
            ) {
              return;
            }

            const lat = Number(
              latitude
            );
            const lng = Number(
              longitude
            );

            if (
              !Number.isFinite(lat) ||
              lat < -90 ||
              lat > 90 ||
              !Number.isFinite(lng) ||
              lng < -180 ||
              lng > 180
            ) {
              console.log(
                "❌ Invalid GPS coordinates"
              );
              return;
            }

            const delivery =
              await Delivery.findOne({
                orderId,
                riderId:
                  socket.user._id,
                status: {
                  $in:
                    ACTIVE_DELIVERY_STATUSES,
                },
              }).populate({
                path: "orderId",
                populate: {
                  path: "addressId",
                },
              });

            if (!delivery) {
              console.log(
                "❌ Rider is not assigned to an active delivery"
              );
              return;
            }

            if (delivery.status === "DELIVERED" || delivery.orderId?.orderStatus === "DELIVERED") {
              return;
            }

            const now =
              new Date();

            const lastLocationAt =
              socket.data.lastLocationAt || 0;

            if (
              now.getTime() -
                lastLocationAt <
              1000
            ) {
              return;
            }

            socket.data.lastLocationAt =
              now.getTime();

            delivery.currentLocation =
              {
                latitude: lat,
                longitude: lng,
                accuracy:
                  Number.isFinite(
                    Number(accuracy)
                  )
                    ? Math.max(
                        0,
                        Number(
                          accuracy
                        )
                      )
                    : null,
                speed:
                  Number.isFinite(
                    Number(speed)
                  )
                    ? Math.max(
                        0,
                        Number(speed)
                      )
                    : null,
                heading:
                  Number.isFinite(
                    Number(heading)
                  )
                    ? Math.min(
                        360,
                        Math.max(
                          0,
                          Number(
                            heading
                          )
                        )
                      )
                    : null,
                updatedAt: now,
              };

            await delivery.save();

            await User.findByIdAndUpdate(
              socket.user._id,
              {
                currentLocation:
                  {
                    latitude: lat,
                    longitude: lng,
                    updatedAt: now,
                  },
                lastSeen: now,
              }
            );

            const payload = {
              orderId:
                delivery.orderId?._id ??
                delivery.orderId,
              deliveryId:
                delivery._id,
              partnerId:
                socket.user._id,
              latitude: lat,
              longitude: lng,
              accuracy:
                delivery
                  .currentLocation
                  .accuracy,
              speed:
                delivery
                  .currentLocation
                  .speed,
              heading:
                delivery
                  .currentLocation
                  .heading,
              destination:
                delivery.orderId
                  ?.addressId
                  ? {
                      latitude:
                        delivery
                          .orderId
                          .addressId
                          .latitude,
                      longitude:
                        delivery
                          .orderId
                          .addressId
                          .longitude,
                    }
                  : null,
              updatedAt: now,
            };

            emitPartnerLocation(
              delivery.orderId?._id ??
              delivery.orderId,
              payload
            );
          } catch (error) {
            console.error(
              "Location update failed:",
              error
            );
          }
        }
      );

      socket.on(
        "disconnect",
        async () => {
          try {
            if (
              socket.user.role ===
              "PARTNER"
            ) {
              const partnerId =
                getUserId(socket);

              const count =
                removePartnerSocket(
                  partnerId,
                  socket.id
                );

              if (count === 0) {
                const now =
                  new Date();

                await User.findByIdAndUpdate(
                  partnerId,
                  {
                    isOnline: false,
                    lastSeen: now,
                  }
                );

                emitPartnerOnlineStatus(
                  partnerId,
                  false
                );
              }
            }

            console.log(
              `🔴 Socket Disconnected: ${socket.id}`
            );
          } catch (error) {
            console.error(
              "Socket disconnect handling failed:",
              error
            );
          }
        }
      );
    }
  );
};

export default registerSocketEvents;
