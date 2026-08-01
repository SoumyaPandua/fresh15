import Delivery from "./delivery.model.js";
import Order from "../order/order.model.js";

export const getAllDeliveriesService = async () => {
  return await Delivery.find()
    .populate({
      path: "orderId",
      select:
        "orderNumber orderStatus grandTotal paymentStatus",
    })
    .populate("riderId", "name email phone")
    .sort({ createdAt: -1 });
};

export const getDeliveryByIdService = async (
  id
) => {
  const delivery = await Delivery.findById(id)
    .populate({
      path: "orderId",
      select:
        "orderNumber orderStatus grandTotal paymentStatus",
    })
    .populate("riderId", "name email phone");

  if (!delivery) {
    throw new Error("Delivery not found");
  }

  return delivery;
};

export const createDeliveryService = async (
  userId,
  body
) => {
  const order = await Order.findById(body.orderId);

  if (!order) {
    throw new Error("Order not found");
  }

  const existing = await Delivery.findOne({
    orderId: body.orderId,
  });

  if (existing) {
    throw new Error(
      "Delivery already exists for this order"
    );
  }

  const delivery = await Delivery.create({
    orderId: body.orderId,
    deliveryCharge: order.deliveryCharge,
    createdBy: userId,
  });

  return await Delivery.findById(delivery._id)
    .populate("orderId");
};

export const assignRiderService = async (
  id,
  riderId,
  userId
) => {
  const delivery = await Delivery.findById(id);

  if (!delivery) {
    throw new Error("Delivery not found");
  }

  if (delivery.status !== "PENDING") {
    throw new Error(
      "Rider already assigned"
    );
  }

  delivery.riderId = riderId;
  delivery.status = "ASSIGNED";
  delivery.assignedAt = new Date();
  delivery.riderStatus = "BUSY";
  delivery.updatedBy = userId;

  await delivery.save();

  await Order.findByIdAndUpdate(
    delivery.orderId,
    {
      orderStatus: "CONFIRMED",
      updatedBy: userId,
    }
  );

  return await Delivery.findById(delivery._id)
    .populate("orderId")
    .populate("riderId", "name email phone");
};

export const updateDeliveryStatusService =
  async (id, status, userId) => {
    const delivery =
      await Delivery.findById(id);

    if (!delivery) {
      throw new Error(
        "Delivery not found"
      );
    }

    switch (status) {
      case "ACCEPTED":
        if (
          delivery.status !==
          "ASSIGNED"
        ) {
          throw new Error(
            "Delivery must be assigned first"
          );
        }

        delivery.acceptedAt =
          new Date();

        break;

      case "PICKED_UP":
        if (
          delivery.status !==
          "ACCEPTED"
        ) {
          throw new Error(
            "Delivery must be accepted first"
          );
        }

        delivery.pickedUpAt =
          new Date();

        break;

      case "OUT_FOR_DELIVERY":
        if (
          delivery.status !==
          "PICKED_UP"
        ) {
          throw new Error(
            "Pickup required first"
          );
        }

        break;

      case "DELIVERED":
        if (
          delivery.status !==
          "OUT_FOR_DELIVERY"
        ) {
          throw new Error(
            "Delivery is not out for delivery"
          );
        }

        delivery.deliveredAt =
          new Date();

        delivery.earning =
          delivery.deliveryCharge;

        delivery.riderStatus =
          "ONLINE";

        break;

      case "REJECTED":
        delivery.riderStatus =
          "ONLINE";
        break;

      case "CANCELLED":
        delivery.riderStatus =
          "ONLINE";
        break;
    }

    delivery.status = status;
    delivery.updatedBy = userId;

    await delivery.save();

    const orderStatusMap = {
      ASSIGNED: "CONFIRMED",
      ACCEPTED: "CONFIRMED",
      PICKED_UP: "READY_FOR_PICKUP",
      OUT_FOR_DELIVERY:
        "OUT_FOR_DELIVERY",
      DELIVERED: "DELIVERED",
      CANCELLED: "CANCELLED",
    };

    if (orderStatusMap[status]) {
      await Order.findByIdAndUpdate(
        delivery.orderId,
        {
          orderStatus:
            orderStatusMap[status],
          updatedBy: userId,
        }
      );
    }

    return await Delivery.findById(
      delivery._id
    )
      .populate("orderId")
      .populate(
        "riderId",
        "name email phone"
      );
  };

export const deleteDeliveryService =
  async (id) => {
    const delivery =
      await Delivery.findById(id);

    if (!delivery) {
      throw new Error(
        "Delivery not found"
      );
    }

    await delivery.deleteOne();

    return;
  };