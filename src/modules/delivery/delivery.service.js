import Delivery from "./delivery.model.js";
import Order from "../order/order.model.js";
import User from "../user/user.model.js";
import Profile from "../profile/profile.model.js";

const ACTIVE_DELIVERY_STATUSES = [
  "ASSIGNED",
  "ACCEPTED",
  "PICKED_UP",
  "OUT_FOR_DELIVERY",
];

const getPopulatedDelivery = async (id) => {
  return await Delivery.findById(id)
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
};

const releaseRider = async (
  riderId,
  deliveryId,
  {
    completed = false,
    earning = 0,
  } = {}
) => {
  if (!riderId) {
    return;
  }

  const profile = await Profile.findOne({
    userId: riderId,
  });

  if (!profile) {
    return;
  }

  profile.currentDeliveryId = null;

  if (profile.isOnline) {
    profile.deliveryStatus = "AVAILABLE";
  } else {
    profile.deliveryStatus = "OFFLINE";
  }

  if (completed) {
    profile.totalDeliveries =
      Number(profile.totalDeliveries || 0) + 1;

    profile.totalEarnings =
      Number(profile.totalEarnings || 0) +
      Number(earning || 0);
  }

  await profile.save();
};

export const getAllDeliveriesService = async () => {
  return await Delivery.find()
    .populate({
      path: "orderId",
      populate: {
        path: "addressId",
      },
    })
    .populate(
      "riderId",
      "name email phone profileImage role portal"
    )
    .sort({
      createdAt: -1,
    });
};

export const getDeliveryByIdService = async (
  id,
  userId,
  userRole
) => {
  const delivery =
    await getPopulatedDelivery(id);

  if (!delivery) {
    throw new Error("Delivery not found");
  }

  if (
    userRole === "PARTNER" &&
    (
      !delivery.riderId ||
      String(delivery.riderId._id ?? delivery.riderId) !==
      String(userId)
    )
  ) {
    throw new Error(
      "This delivery is not assigned to you"
    );
  }

  return delivery;
};

export const getMyDeliveriesService = async (
  riderId
) => {
  return await Delivery.find({
    riderId,
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
    )
    .sort({
      createdAt: -1,
    });
};

export const getMyActiveDeliveryService = async (
  riderId
) => {
  return await Delivery.findOne({
    riderId,
    status: {
      $in: [
        "ASSIGNED",
        "ACCEPTED",
        "PICKED_UP",
        "OUT_FOR_DELIVERY",
      ],
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
    )
    .sort({
      assignedAt: -1,
    });
};

export const createDeliveryService = async (
  userId,
  body
) => {
  if (!body.orderId) {
    throw new Error("Order ID is required");
  }

  const order = await Order.findById(
    body.orderId
  );

  if (!order) {
    throw new Error("Order not found");
  }

  if (order.orderStatus === "CANCELLED") {
    throw new Error(
      "Cannot create delivery for a cancelled order"
    );
  }

  if (order.orderStatus === "DELIVERED") {
    throw new Error(
      "Order is already delivered"
    );
  }

  const existing =
    await Delivery.findOne({
      orderId: body.orderId,
    });

  if (existing) {
    throw new Error(
      "Delivery already exists for this order"
    );
  }

  const delivery =
    await Delivery.create({
      orderId: body.orderId,
      deliveryCharge:
        Number(order.deliveryCharge) || 0,
      estimatedDeliveryTime:
        body.estimatedDeliveryTime || null,
      notes: body.notes || "",
      createdBy: userId,
    });

  return await getPopulatedDelivery(
    delivery._id
  );
};

export const assignRiderService = async (
  id,
  riderId,
  userId
) => {
  if (!riderId) {
    throw new Error(
      "Delivery partner is required"
    );
  }

  const delivery =
    await Delivery.findById(id);

  if (!delivery) {
    throw new Error("Delivery not found");
  }

  if (delivery.status !== "PENDING") {
    throw new Error(
      "Delivery is not available for assignment"
    );
  }

  const order = await Order.findById(
    delivery.orderId
  );

  if (!order) {
    throw new Error("Order not found");
  }

  if (
    order.orderStatus === "CANCELLED" ||
    order.orderStatus === "DELIVERED"
  ) {
    throw new Error(
      `Cannot assign rider to ${order.orderStatus.toLowerCase()} order`
    );
  }

  const rider = await User.findById(
    riderId
  );

  if (!rider) {
    throw new Error(
      "Delivery partner not found"
    );
  }

  if (
    rider.role !== "PARTNER" ||
    rider.portal !== "partner"
  ) {
    throw new Error(
      "Selected user is not a delivery partner"
    );
  }

  if (rider.isActive === false) {
    throw new Error(
      "Delivery partner account is inactive"
    );
  }

  const profile =
    await Profile.findOne({
      userId: riderId,
    });

  if (!profile) {
    throw new Error(
      "Delivery partner profile not found"
    );
  }

  if (
    !profile.isOnline ||
    profile.deliveryStatus !== "AVAILABLE"
  ) {
    throw new Error(
      "Delivery partner is not available"
    );
  }

  if (profile.currentDeliveryId) {
    throw new Error(
      "Delivery partner already has an active delivery"
    );
  }

  const activeDelivery =
    await Delivery.findOne({
      riderId,
      status: {
        $in: ACTIVE_DELIVERY_STATUSES,
      },
    });

  if (activeDelivery) {
    throw new Error(
      "Delivery partner already has an active delivery"
    );
  }

  delivery.riderId = riderId;
  delivery.status = "ASSIGNED";
  delivery.assignedAt = new Date();
  delivery.riderStatus = "BUSY";
  delivery.updatedBy = userId;

  await delivery.save();

  profile.deliveryStatus = "BUSY";
  profile.currentDeliveryId =
    delivery._id;

  await profile.save();

  await Order.findByIdAndUpdate(
    delivery.orderId,
    {
      orderStatus: "CONFIRMED",
      deliveryPartnerId: riderId,
      updatedBy: userId,
    }
  );

  return await getPopulatedDelivery(
    delivery._id
  );
};

export const updateDeliveryStatusService =
  async (
    id,
    status,
    userId,
    userRole
  ) => {
    const delivery =
      await Delivery.findById(id);

    if (!delivery) {
      throw new Error(
        "Delivery not found"
      );
    }

    if (userRole === "PARTNER") {
      if (
        !delivery.riderId ||
        String(delivery.riderId) !== String(userId)
      ) {
        throw new Error(
          "This delivery is not assigned to you"
        );
      }
    }

    const nextStatus =
      String(status || "").toUpperCase();

    const allowedStatuses = [
      "ACCEPTED",
      "PICKED_UP",
      "OUT_FOR_DELIVERY",
      "DELIVERED",
      "REJECTED",
      "CANCELLED",
    ];

    if (
      !allowedStatuses.includes(nextStatus)
    ) {
      throw new Error(
        "Invalid delivery status"
      );
    }

    if (
      delivery.status === "DELIVERED"
    ) {
      throw new Error(
        "Delivered delivery cannot be modified"
      );
    }

    if (
      delivery.status === "CANCELLED"
    ) {
      throw new Error(
        "Cancelled delivery cannot be modified"
      );
    }

    if (
      delivery.status === "REJECTED"
    ) {
      throw new Error(
        "Rejected delivery cannot be modified"
      );
    }

    const now = new Date();

    switch (nextStatus) {
      case "ACCEPTED":
        if (
          delivery.status !== "ASSIGNED"
        ) {
          throw new Error(
            "Delivery must be assigned first"
          );
        }

        if (!delivery.riderId) {
          throw new Error(
            "Delivery partner is not assigned"
          );
        }

        delivery.acceptedAt = now;
        delivery.riderStatus = "BUSY";

        break;

      case "PICKED_UP":
        if (
          delivery.status !== "ACCEPTED"
        ) {
          throw new Error(
            "Delivery must be accepted first"
          );
        }

        delivery.pickedUpAt = now;
        delivery.riderStatus = "BUSY";

        break;

      case "OUT_FOR_DELIVERY":
        if (
          delivery.status !==
          "PICKED_UP"
        ) {
          throw new Error(
            "Order must be picked up first"
          );
        }

        delivery.riderStatus = "BUSY";

        break;

      case "DELIVERED":
        if (
          delivery.status !==
          "OUT_FOR_DELIVERY"
        ) {
          throw new Error(
            "Delivery must be out for delivery first"
          );
        }

        delivery.deliveredAt = now;

        delivery.earning =
          Number(
            delivery.deliveryCharge
          ) || 0;

        delivery.riderStatus =
          "ONLINE";

        break;

      case "REJECTED":
        if (
          delivery.status !==
          "ASSIGNED"
        ) {
          throw new Error(
            "Only an assigned delivery can be rejected"
          );
        }

        delivery.rejectedAt = now;

        const rejectedRiderId =
          delivery.riderId;

        await releaseRider(
          rejectedRiderId,
          delivery._id
        );

        delivery.riderId = null;
        delivery.status = "PENDING";
        delivery.riderStatus = "OFFLINE";
        delivery.assignedAt = null;
        delivery.updatedBy = userId;

        await delivery.save();

        await Order.findByIdAndUpdate(
          delivery.orderId,
          {
            orderStatus: "CONFIRMED",
            deliveryPartnerId: null,
            updatedBy: userId,
          }
        );

        return await getPopulatedDelivery(
          delivery._id
        );

      case "CANCELLED":
        delivery.cancelledAt = now;
        delivery.riderStatus =
          "ONLINE";

        break;
    }

    delivery.status = nextStatus;
    delivery.updatedBy = userId;

    await delivery.save();

    const orderStatusMap = {
      ACCEPTED: "CONFIRMED",
      PICKED_UP: "READY_FOR_PICKUP",
      OUT_FOR_DELIVERY:
        "OUT_FOR_DELIVERY",
      DELIVERED: "DELIVERED",
      CANCELLED: "CANCELLED",
    };

    if (
      orderStatusMap[nextStatus]
    ) {
      const orderUpdate = {
        orderStatus:
          orderStatusMap[nextStatus],
        updatedBy: userId,
      };

      if (
        nextStatus === "DELIVERED"
      ) {
        orderUpdate.deliveryPartnerId =
          delivery.riderId;
      }

      if (
        nextStatus === "CANCELLED"
      ) {
        orderUpdate.deliveryPartnerId =
          null;
      }

      await Order.findByIdAndUpdate(
        delivery.orderId,
        orderUpdate
      );
    }

    if (
      nextStatus === "DELIVERED"
    ) {
      await releaseRider(
        delivery.riderId,
        delivery._id,
        {
          completed: true,
          earning:
            delivery.earning,
        }
      );
    }

    if (
      nextStatus === "REJECTED"
    ) {
      await releaseRider(
        delivery.riderId,
        delivery._id
      );

      await Order.findByIdAndUpdate(
        delivery.orderId,
        {
          orderStatus: "CONFIRMED",
          deliveryPartnerId: null,
          updatedBy: userId,
        }
      );
    }

    if (
      nextStatus === "CANCELLED"
    ) {
      await releaseRider(
        delivery.riderId,
        delivery._id
      );
    }

    return await getPopulatedDelivery(
      delivery._id
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

    if (
      ACTIVE_DELIVERY_STATUSES.includes(
        delivery.status
      )
    ) {
      throw new Error(
        "Active delivery cannot be deleted"
      );
    }

    if (delivery.riderId) {
      await releaseRider(
        delivery.riderId,
        delivery._id
      );
    }

    await delivery.deleteOne();

    return;
  };