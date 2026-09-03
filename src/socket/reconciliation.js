import Order from "../modules/order/order.model.js";
import Delivery from "../modules/delivery/delivery.model.js";

const ACTIVE = ["ASSIGNED", "ACCEPTED", "PICKED_UP", "OUT_FOR_DELIVERY"];

export default function registerReconciliation(io) {
  io.on("connection", (socket) => {
    socket.on("realtime:reconcile", async ({ orderId } = {}, ack) => {
      try {
        if (!orderId) throw new Error("orderId is required");
        const isAdmin = socket.user?.role === "ADMIN" || socket.user?.role === "SUPER_ADMIN";
        const orderQuery = isAdmin ? { _id: orderId, isDeleted: false } : { _id: orderId, userId: socket.user?._id, isDeleted: false };
        const order = await Order.findOne(orderQuery).populate("addressId").lean();
        if (!order && socket.user?.role === "PARTNER") {
          const delivery = await Delivery.findOne({ orderId, riderId: socket.user._id, status: { $in: ACTIVE } }).select("_id").lean();
          if (!delivery) throw new Error("Order is not accessible");
        } else if (!order) {
          throw new Error("Order is not accessible");
        }

        const delivery = await Delivery.findOne({ orderId, ...(socket.user?.role === "PARTNER" ? { riderId: socket.user._id } : {}) })
          .select("_id orderId riderId status currentLocation")
          .lean();

        const result = { order, delivery, reconciledAt: new Date().toISOString() };
        if (typeof ack === "function") ack({ success: true, data: result });
        socket.emit("realtime:reconciled", result);
      } catch (error) {
        if (typeof ack === "function") ack({ success: false, message: error.message });
      }
    });
  });
}
