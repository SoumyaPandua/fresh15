import {
    adminRoom,
    customerRoom,
    partnerRoom,
    orderRoom,
} from "./rooms.js";

import User from "../modules/user/user.model.js";
import { emitPartnerLocation, emitPartnerOnlineStatus } from "./emitters.js";
import Delivery from "../modules/delivery/delivery.model.js";

const registerSocketEvents = (io) => {
    io.on("connection", async (socket) => {
        console.log(`🟢 Socket Connected: ${socket.id}`);

        // ==========================
        // ADMIN
        // ==========================
        socket.on("join:admin", () => {
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
        });

        // ==========================
        // CUSTOMER
        // ==========================
        socket.on("join:customer", () => {
            socket.join(customerRoom(socket.user._id));

            console.log(
                `🛒 Customer ${socket.user._id} joined`
            );
        });

        // ==========================
        // PARTNER
        // ==========================
        socket.on("join:partner", async () => {

            socket.join(partnerRoom(socket.user._id));

            await User.findByIdAndUpdate(
                socket.user._id,
                {
                    isOnline: true,
                    lastSeen: new Date(),
                }
            );

            emitPartnerOnlineStatus(
                socket.user._id,
                true
            );

            console.log(
                `🚚 Partner ${socket.user._id} joined`
            );

        });

        // ==========================
        // ORDER ROOM
        // ==========================
        socket.on("join:order", ({ orderId }) => {
            socket.join(orderRoom(orderId));

            console.log(
                `📦 Order room joined: ${orderId}`
            );
        });

        socket.on(
            "location:update",
            async ({ orderId, latitude, longitude }) => {
                try {
                    if (socket.user.role !== "PARTNER") {
                        return;
                    }

                    const delivery = await Delivery.findOne({
                        orderId,
                        riderId: socket.user._id,
                        status: {
                            $in: [
                                "ASSIGNED",
                                "ACCEPTED",
                                "PICKED_UP",
                                "OUT_FOR_DELIVERY",
                            ],
                        },
                    });

                    if (!delivery) {
                        console.log(
                            "❌ Rider is not assigned to this delivery"
                        );
                        return;
                    }

                    await User.findByIdAndUpdate(socket.user._id, {
                        currentLocation: {
                            latitude,
                            longitude,
                            updatedAt: new Date(),
                        },
                    });

                    emitPartnerLocation(orderId, {
                        orderId,
                        partnerId: socket.user._id,
                        latitude,
                        longitude,
                        updatedAt: new Date(),
                    });

                } catch (error) {
                    console.error(error);
                }
            }
        );

        socket.on("disconnect", async () => {
            try {

                if (socket.user.role === "PARTNER") {

                    await User.findByIdAndUpdate(
                        socket.user._id,
                        {
                            isOnline: false,
                            lastSeen: new Date(),
                        }
                    );

                    emitPartnerOnlineStatus(
                        socket.user._id,
                        false
                    );
                }

                console.log(
                    `🔴 Socket Disconnected: ${socket.id}`
                );

            } catch (error) {
                console.error(error);
            }
        });
    });
};

export default registerSocketEvents;