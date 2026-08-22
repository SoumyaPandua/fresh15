import mongoose from "mongoose";
import Cart from "../cart/cart.model.js";
import Inventory from "../inventory/inventory.model.js";
import Address from "../address/address.model.js";
import Product from "../product/product.model.js";
import Order from "./order.model.js";
import {
  applyCouponService,
  markCouponUsedService,
  releaseCouponUsageService,
} from "../coupon/coupon.service.js";
import { sendNotificationService } from "../notification/notification.service.js";
import { processBackInStockAlertService } from "../productAlert/productAlert.service.js";
import { emitNewOrder, emitOrderUpdated } from "../../socket/emitters.js";
import AppError from "../../utils/AppError.js";
import { writeAuditLog } from "../audit/audit.service.js";
import { parsePagination, buildPagination } from "../../utils/pagination.js";
import Setting from "../setting/setting.model.js";
import {
  reserveDeliverySlotService,
  releaseReservedDeliverySlotService,
} from "../deliverySlot/deliverySlot.service.js";

export const ONLINE_PAYMENT_WINDOW_MS = 5 * 60 * 1000;

const ORDER_TRANSITIONS = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PACKING", "CANCELLED"],
  PACKING: ["READY_FOR_PICKUP", "CANCELLED"],
  READY_FOR_PICKUP: ["OUT_FOR_DELIVERY", "CANCELLED"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

const reserveInventoryItem = async (productId, quantity) => {
  const inventory = await Inventory.findOneAndUpdate(
    {
      productId,
      $expr: { $gte: [{ $subtract: ["$currentStock", "$reservedStock"] }, quantity] },
    },
    [
      { $set: { reservedStock: { $add: ["$reservedStock", quantity] } } },
      {
        $set: {
          availableStock: { $max: [0, { $subtract: ["$currentStock", "$reservedStock"] }] },
          status: {
            $cond: [
              { $eq: [{ $max: [0, { $subtract: ["$currentStock", "$reservedStock"] }] }, 0] },
              "OUT_OF_STOCK",
              {
                $cond: [
                  { $lte: [{ $max: [0, { $subtract: ["$currentStock", "$reservedStock"] }] }, "$lowStockThreshold"] },
                  "LOW_STOCK",
                  "IN_STOCK",
                ],
              },
            ],
          },
        },
      },
    ],
    { new: true, updatePipeline: true }
  );

  if (!inventory) {
    throw new AppError(409, "INSUFFICIENT_STOCK", "Insufficient stock");
  }

  return inventory;
};

const releaseInventoryItem = async (productId, quantity) => {
  const before = await Inventory.findOne({ productId }).select(
    "availableStock"
  );

  const inventory = await Inventory.findOneAndUpdate(
    { productId, reservedStock: { $gte: quantity } },
    [
      { $set: { reservedStock: { $subtract: ["$reservedStock", quantity] } } },
      {
        $set: {
          availableStock: { $max: [0, { $subtract: ["$currentStock", "$reservedStock"] }] },
          status: {
            $cond: [
              { $eq: [{ $max: [0, { $subtract: ["$currentStock", "$reservedStock"] }] }, 0] },
              "OUT_OF_STOCK",
              {
                $cond: [
                  { $lte: [{ $max: [0, { $subtract: ["$currentStock", "$reservedStock"] }] }, "$lowStockThreshold"] },
                  "LOW_STOCK",
                  "IN_STOCK",
                ],
              },
            ],
          },
        },
      },
    ],
    { new: true, updatePipeline: true }
  );

  if (
    inventory &&
    Number(before?.availableStock ?? 0) <= 0 &&
    Number(inventory.availableStock ?? 0) > 0
  ) {
    try {
      await processBackInStockAlertService({
        productId,
        previousAvailableStock: Number(before?.availableStock ?? 0),
        currentAvailableStock: Number(inventory.availableStock),
      });
    } catch (alertError) {
      console.error("Back-in-stock alert processing failed:", alertError.message);
    }
  }
};

const finalizeInventoryItem = async (productId, quantity) => {
  const inventory = await Inventory.findOneAndUpdate(
    { productId, reservedStock: { $gte: quantity }, currentStock: { $gte: quantity } },
    [
      {
        $set: {
          currentStock: { $subtract: ["$currentStock", quantity] },
          reservedStock: { $subtract: ["$reservedStock", quantity] },
        },
      },
      {
        $set: {
          availableStock: { $max: [0, { $subtract: ["$currentStock", "$reservedStock"] }] },
          status: {
            $cond: [
              { $eq: [{ $max: [0, { $subtract: ["$currentStock", "$reservedStock"] }] }, 0] },
              "OUT_OF_STOCK",
              {
                $cond: [
                  { $lte: [{ $max: [0, { $subtract: ["$currentStock", "$reservedStock"] }] }, "$lowStockThreshold"] },
                  "LOW_STOCK",
                  "IN_STOCK",
                ],
              },
            ],
          },
        },
      },
    ],
    { new: true, updatePipeline: true }
  );

  if (!inventory) {
    throw new AppError(409, "INVENTORY_FINALIZATION_CONFLICT", "Unable to finalize reserved inventory");
  }
};

export const releaseOrderStockService = async (order) => {
  if (!order?.stockReserved || order.stockFinalized) return;

  for (const item of order.items) {
    await releaseInventoryItem(item.productId, item.quantity);
  }

  order.stockReserved = false;
  await order.save();
};

export const finalizeOrderStockService = async (order) => {
  if (!order?.stockReserved || order.stockFinalized) return;

  for (const item of order.items) {
    await finalizeInventoryItem(item.productId, item.quantity);
  }

  order.stockReserved = false;
  order.stockFinalized = true;
  await order.save();
};

export const getMyOrdersService = async (userId, query = {}) => {
  const pagination = parsePagination(query);
  const filter = { userId, isDeleted: false };
  const base = Order.find(filter).populate("addressId").sort({ createdAt: -1 });
  if (!pagination.hasPagination) return await base;
  const [orders, total] = await Promise.all([
    base.skip(pagination.skip).limit(pagination.limit),
    Order.countDocuments(filter),
  ]);
  return {
    items: orders,
    pagination: buildPagination({
      page: pagination.page,
      limit: pagination.limit,
      total,
    }),
  };
};

export const getOrderByIdService = async (id, userId) => {
  const order = await Order.findOne({
    _id: id,
    userId,
    isDeleted: false,
  }).populate("addressId");

  if (!order) {
    throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");
  }

  return order;
};

const buildOrderSubstitutionSnapshot = async (cartItem, product) => {
  const preference = cartItem.substitutionPreference || {
    type: "CALL_ME",
    preferredReplacementProductId: null,
  };

  const snapshot = {
    type: preference.type || "CALL_ME",
    preferredReplacementProductId: preference.preferredReplacementProductId || null,
    preferredReplacementProductName: "",
    preferredReplacementSku: "",
    preferredReplacementImage: null,
  };

  if (snapshot.type !== "SPECIFIC_ITEM" || !snapshot.preferredReplacementProductId) {
    snapshot.preferredReplacementProductId = null;
    return snapshot;
  }

  if (snapshot.preferredReplacementProductId.toString() === product._id.toString()) {
    throw new AppError(
      400,
      "INVALID_REPLACEMENT_PRODUCT",
      "Preferred replacement must be different from the ordered product"
    );
  }

  const replacement = await Product.findOne({
    _id: snapshot.preferredReplacementProductId,
    isDeleted: false,
    isActive: true,
  }).select("name images sku categoryId");

  if (!replacement) {
    throw new AppError(
      409,
      "REPLACEMENT_PRODUCT_UNAVAILABLE",
      "Preferred replacement product is no longer available"
    );
  }

  if (
    product.categoryId &&
    replacement.categoryId &&
    product.categoryId.toString() !== replacement.categoryId.toString()
  ) {
    throw new AppError(
      409,
      "REPLACEMENT_CATEGORY_CONFLICT",
      "Preferred replacement must belong to the same category"
    );
  }

  snapshot.preferredReplacementProductName = replacement.name;
  snapshot.preferredReplacementSku = replacement.sku;
  snapshot.preferredReplacementImage = replacement.images?.[0] || null;

  return snapshot;
};

export const createOrderService = async (userId, body) => {
  const address = await Address.findOne({ _id: body.addressId, userId });
  if (!address) {
    throw new AppError(404, "ADDRESS_NOT_FOUND", "Address not found");
  }

  const cart = await Cart.findOne({ userId }).populate({
    path: "items.productId",
    select: "name images sku sellingPrice isActive isDeleted categoryId",
  });

  if (!cart || cart.items.length === 0) {
    throw new AppError(409, "CART_EMPTY", "Cart is empty");
  }

  const orderItems = [];
  let subtotal = 0;
  const reservedItems = [];
  let createdOrder = null;
  let reservedDeliverySlot = null;

  try {
    for (const item of cart.items) {
      const product = item.productId;

      if (!product || product.isDeleted || product.isActive === false) {
        throw new AppError(
          409,
          "PRODUCT_UNAVAILABLE",
          "A product in your cart is no longer available"
        );
      }

      const price = Number(product.sellingPrice);
      const quantity = Number(item.quantity);
      const itemSubtotal = Number((price * quantity).toFixed(2));

      await reserveInventoryItem(product._id, quantity);
      reservedItems.push({ productId: product._id, quantity });

      const substitutionPreference =
        await buildOrderSubstitutionSnapshot(item, product);

      orderItems.push({
        productId: product._id,
        productName: product.name,
        image: product.images?.[0] || null,
        sku: product.sku,
        price,
        quantity,
        subtotal: itemSubtotal,
        substitutionPreference,
      });

      subtotal += itemSubtotal;
    }

    subtotal = Number(subtotal.toFixed(2));

    let discount = 0;
    let couponId = null;
    let couponCode = "";

    if (body.couponCode) {
      const coupon = await applyCouponService(body.couponCode, subtotal);
      discount = coupon.discountAmount;
      couponId = coupon.couponId;
      couponCode = coupon.code;
    }

    reservedDeliverySlot = await reserveDeliverySlotService({
      userId,
      addressId: body.addressId,
      slotId: body.deliverySlotId,
      dateKey: body.deliveryDateKey,
    });

    const setting = await Setting.findOne();
    const configuredDeliveryCharge = Number(setting?.deliveryCharge ?? 40);
    const freeDeliveryAbove = Number(setting?.freeDeliveryAbove ?? 500);
    const deliveryCharge =
      subtotal >= freeDeliveryAbove ? 0 : configuredDeliveryCharge;
    const tax = 0;
    const grandTotal = Number(
      (subtotal + deliveryCharge + tax - discount).toFixed(2)
    );
    const orderNumber = `ORD-${Date.now()
      .toString()
      .slice(-10)}-${Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0")}`;

    const order = await Order.create({
      orderNumber,
      userId,
      addressId: body.addressId,
      zoneId: reservedDeliverySlot.zoneId,
      storeId: reservedDeliverySlot.storeId,
      deliverySlotId: reservedDeliverySlot.slotId,
      deliveryDateKey: reservedDeliverySlot.dateKey,
      deliverySlotLabel: reservedDeliverySlot.label,
      promisedDeliveryAt: reservedDeliverySlot.promisedAt,
      items: orderItems,
      totalItems: orderItems.length,
      totalQuantity: orderItems.reduce(
        (sum, item) => sum + item.quantity,
        0
      ),
      subtotal,
      deliveryCharge,
      discount,
      couponId,
      couponCode,
      couponDiscount: discount,
      tax,
      grandTotal,
      paymentMethod: body.paymentMethod,
      paymentStatus: "PENDING",
      paymentExpiresAt:
        body.paymentMethod === "ONLINE"
          ? new Date(Date.now() + ONLINE_PAYMENT_WINDOW_MS)
          : null,
      orderStatus:
        body.paymentMethod === "COD" ? "CONFIRMED" : "PENDING",
      stockReserved: true,
      createdBy: userId,
      notes: body.notes || "",
    });

    createdOrder = order;

    if (couponId) {
      await markCouponUsedService(couponId);
      order.couponUsageRecorded = true;
      await order.save();
    }

    cart.items = [];
    cart.calculateTotals();
    await cart.save();

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
      console.error("Order placed notification failed:", error.message);
    }

    return await Order.findById(order._id)
      .populate("addressId")
      .populate("userId", "name email phone");
  } catch (error) {
    if (createdOrder) {
      try {
        if (createdOrder.couponUsageRecorded && createdOrder.couponId) {
          await releaseCouponUsageService(createdOrder.couponId);
        }
        await createdOrder.deleteOne();
      } catch (rollbackOrderError) {
        console.error("Order rollback failed:", rollbackOrderError.message);
      }
    }

    if (reservedDeliverySlot) {
      try {
        await releaseReservedDeliverySlotService(
          reservedDeliverySlot.slotId,
          reservedDeliverySlot.dateKey
        );
      } catch (slotReleaseError) {
        console.error("Delivery slot rollback failed:", slotReleaseError.message);
      }
    }

    for (const item of reservedItems.reverse()) {
      try {
        await releaseInventoryItem(item.productId, item.quantity);
      } catch (releaseError) {
        console.error("Inventory rollback failed:", releaseError.message);
      }
    }

    throw error;
  }
};

export const updateOrderStatusService = async (
  id,
  userId,
  orderStatus
) => {
  const order = await Order.findOne({
    _id: id,
    isDeleted: false,
  });

  if (!order) {
    throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");
  }

  if (order.orderStatus === orderStatus) {
    throw new AppError(409, "STATE_CONFLICT", "Order is already in this state");
  }

  if (order.paymentMethod === "ONLINE" && order.paymentStatus !== "PAID") {
    if (orderStatus !== "CANCELLED") {
      throw new AppError(
        409,
        "PAYMENT_PENDING",
        "Online payment is still pending. Complete the payment before processing this order."
      );
    }
  }

  if (orderStatus === "CANCELLED" && order.paymentStatus === "PAID") {
    throw new AppError(
      409,
      "REFUND_REQUIRED",
      "A paid order cannot be cancelled without a refund workflow"
    );
  }

  const allowed = ORDER_TRANSITIONS[order.orderStatus] || [];

  if (!allowed.includes(orderStatus)) {
    throw new AppError(
      409,
      "INVALID_ORDER_TRANSITION",
      `Cannot move order from ${order.orderStatus} to ${orderStatus}`
    );
  }

  if (orderStatus === "DELIVERED" && order.paymentMethod === "COD" && order.paymentStatus !== "PAID") {
    throw new AppError(
      409,
      "COD_PAYMENT_REQUIRED",
      "Collect COD payment before marking the order as delivered"
    );
  }

  order.orderStatus = orderStatus;
  order.updatedBy = userId;
  await order.save();

  if (orderStatus === "DELIVERED") {
    await finalizeOrderStockService(order);
  }

  if (orderStatus === "CANCELLED") {
    await releaseOrderStockService(order);

    if (order.deliverySlotId && order.deliveryDateKey) {
      await releaseReservedDeliverySlotService(
        order.deliverySlotId,
        order.deliveryDateKey
      );
      order.deliverySlotId = null;
      order.deliveryDateKey = "";
    }

    if (order.couponUsageRecorded && order.couponId) {
      await releaseCouponUsageService(order.couponId);
      order.couponUsageRecorded = false;
      await order.save();
    }
  }

  emitOrderUpdated(order._id, {
    orderId: order._id,
    customerId: order.userId,
    orderStatus: order.orderStatus,
    paymentStatus: order.paymentStatus,
    updatedAt: order.updatedAt,
  });

  return order;
};

export const cancelMyOrderService = async (id, userId) => {
  const order = await Order.findOne({
    _id: id,
    userId,
    isDeleted: false,
  });

  if (!order) {
    throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");
  }

  if (!["PENDING", "CONFIRMED"].includes(order.orderStatus)) {
    throw new AppError(
      409,
      "ORDER_CANCELLATION_CONFLICT",
      "Order can no longer be cancelled"
    );
  }

  if (order.paymentStatus === "PAID") {
    throw new AppError(
      409,
      "REFUND_REQUIRED",
      "A paid order cannot be cancelled without a refund workflow"
    );
  }

  order.orderStatus = "CANCELLED";
  order.updatedBy = userId;
  await order.save();

  await releaseOrderStockService(order);

  if (order.deliverySlotId && order.deliveryDateKey) {
    await releaseReservedDeliverySlotService(
      order.deliverySlotId,
      order.deliveryDateKey
    );
    order.deliverySlotId = null;
    order.deliveryDateKey = "";
  }

  if (order.couponUsageRecorded && order.couponId) {
    await releaseCouponUsageService(order.couponId);
    order.couponUsageRecorded = false;
    await order.save();
  }

  return order;
};

export const adminArchiveOrderService = async (id, adminId) => {
  const order = await Order.findOne({
    _id: id,
    isDeleted: false,
  });

  if (!order) {
    throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");
  }

  order.isDeleted = true;
  order.deletedAt = new Date();
  order.deletedBy = adminId;
  order.updatedBy = adminId;
  await order.save();

  await writeAuditLog({
    actorId: adminId,
    action: "ORDER_ARCHIVED",
    resourceType: "Order",
    resourceId: order._id,
  });
};

export const getAllOrdersService = async (query = {}) => {
  const pagination = parsePagination(query);
  const filter = { isDeleted: false };

  const base = Order.find(filter)
    .populate("addressId")
    .populate("userId", "name email phone profileImage")
    .sort({ createdAt: -1 });

  if (!pagination.hasPagination) return await base;

  const [orders, total] = await Promise.all([
    base.skip(pagination.skip).limit(pagination.limit),
    Order.countDocuments(filter),
  ]);

  return {
    items: orders,
    pagination: buildPagination({
      page: pagination.page,
      limit: pagination.limit,
      total,
    }),
  };
};

export const getOrderTransitionMap = () => ORDER_TRANSITIONS;