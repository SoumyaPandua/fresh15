import Cart from "../cart/cart.model.js";
import Inventory from "../inventory/inventory.model.js";
import Address from "../address/address.model.js";
import Order from "./order.model.js";
import {
  applyCouponService,
  markCouponUsedService,
} from "../coupon/coupon.service.js";
import User from "../user/user.model.js";

import { sendNotificationService } from "../notification/notification.service.js";
import {
  emitNewOrder,
  emitOrderUpdated,
} from "../../socket/emitters.js";

export const getMyOrdersService = async (userId) => {
  return await Order.find({ userId })
    .populate("addressId")
    .sort({ createdAt: -1 });
};

export const getOrderByIdService = async (id, userId) => {
  const order = await Order.findOne({
    _id: id,
    userId,
  }).populate("addressId");

  if (!order) {
    throw new Error("Order not found");
  }

  return order;
};

export const createOrderService = async (userId, body) => {
  const address = await Address.findOne({
    _id: body.addressId,
    userId,
  });

  if (!address) {
    throw new Error("Address not found");
  }

  const cart = await Cart.findOne({ userId }).populate({
    path: "items.productId",
    select: "name images sku sellingPrice",
  });

  if (!cart || cart.items.length === 0) {
    throw new Error("Cart is empty");
  }

  const orderItems = [];

  for (const item of cart.items) {
    const inventory = await Inventory.findOne({
      productId: item.productId._id,
    });

    if (!inventory) {
      throw new Error(
        `${item.productId.name} inventory not found`
      );
    }

    if (inventory.availableStock < item.quantity) {
      throw new Error(
        `${item.productId.name} is out of stock`
      );
    }

    inventory.currentStock -= item.quantity;

    await inventory.save();

    orderItems.push({
      productId: item.productId._id,
      productName: item.productId.name,
      image: item.productId.images[0] || null,
      sku: item.productId.sku,
      price: item.price,
      quantity: item.quantity,
      subtotal: item.subtotal,
    });
  }

  const deliveryCharge = 40;
  let discount = 0;
  let couponId = null;
  let couponCode = "";
  const tax = 0;

  if (body.couponCode) {
    const coupon = await applyCouponService(
      body.couponCode,
      cart.subtotal
    );

    discount = coupon.discountAmount;
    couponId = coupon.couponId;
    couponCode = coupon.code;
  }

  const grandTotal =
    cart.subtotal +
    deliveryCharge +
    tax -
    discount;

  const orderNumber =
    "ORD-" +
    Date.now().toString().slice(-10);

  const order = await Order.create({
    orderNumber,
    userId,
    addressId: body.addressId,
    items: orderItems,
    totalItems: cart.totalItems,
    totalQuantity: cart.totalQuantity,
    subtotal: cart.subtotal,
    deliveryCharge,
    discount,
    couponId,
    couponCode,
    couponDiscount: discount,
    tax,
    grandTotal,
    paymentMethod: body.paymentMethod,
    notes: body.notes || "",
    createdBy: userId,
  });

  emitNewOrder({
    orderId: order._id,
    orderNumber: order.orderNumber,
    customerId: order.userId,
    totalItems: order.totalItems,
    totalQuantity: order.totalQuantity,
    grandTotal: order.grandTotal,
    paymentMethod: order.paymentMethod,
    orderStatus: order.orderStatus,
    createdAt: order.createdAt,
  });

  if (couponId) {
    await markCouponUsedService(couponId);
  }

  cart.items = [];
  cart.calculateTotals();

  await cart.save();

  // Notification should not break successful order creation
  try {
    await sendNotificationService({
      userId,
      title: "Order placed successfully",
      message: `Your order ${order.orderNumber} has been placed successfully.`,
      type: "ORDER_PLACED",
      channel: "IN_APP",
      metadata: {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
      },
      createdBy: userId,
    });
  } catch (error) {
    console.error(
      "Order placed notification failed:",
      error.message
    );
  }

  return await Order.findById(order._id)
    .populate("addressId")
    .populate("userId", "name email phone");
};

export const updateOrderStatusService = async (
  id,
  userId,
  orderStatus
) => {
  const order = await Order.findById(id);

  if (!order) {
    throw new Error("Order not found");
  }

  order.orderStatus = orderStatus;
  order.updatedBy = userId;

  if (
    order.paymentMethod === "COD" &&
    orderStatus === "DELIVERED"
  ) {
    order.paymentStatus = "PAID";
  }

  await order.save();

  emitOrderUpdated(order._id, {
    orderId: order._id,
    customerId: order.userId,
    orderStatus: order.orderStatus,
    paymentStatus: order.paymentStatus,
    updatedAt: order.updatedAt,
  });

  return order;
};

export const deleteOrderService = async (id) => {
  const order = await Order.findById(id);

  if (!order) {
    throw new Error("Order not found");
  }

  await order.deleteOne();
};

export const getAllOrdersService = async () => {
  return await Order.find()
    .populate("addressId")
    .populate(
      "userId",
      "name email phone profileImage"
    )
    .sort({ createdAt: -1 });
};