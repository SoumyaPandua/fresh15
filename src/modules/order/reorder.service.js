import mongoose from "mongoose";
import Order from "./order.model.js";
import Product from "../product/product.model.js";
import Inventory from "../inventory/inventory.model.js";
import Cart from "../cart/cart.model.js";
import AppError from "../../utils/AppError.js";

const MAX_REORDER_LIST_ITEMS = 40;
const DEFAULT_HISTORY_DAYS = 90;
const MAX_HISTORY_DAYS = 180;
const MAX_REORDER_QUANTITY = 50;
const APP_TIMEZONE = process.env.APP_TIMEZONE || "Asia/Kolkata";

const toObjectId = (value, field = "productId") => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new AppError(400, "INVALID_ID", `Invalid ${field}`);
  }
  return new mongoose.Types.ObjectId(value);
};

const clampInt = (value, min, max, fallback) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

const weekdayInAppTimezone = (date) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    weekday: "short",
  }).format(date);

const productImage = (product) => product?.images?.[0] || null;

const buildSourcePreference = () => ({
  type: "CALL_ME",
  preferredReplacementProductId: null,
});

const getHistoryOrders = async (userId, days) => {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  return Order.find({
    userId,
    isDeleted: false,
    orderStatus: "DELIVERED",
    createdAt: { $gte: since },
  })
    .select("createdAt deliveryDateKey items")
    .sort({ createdAt: -1 })
    .lean();
};

export const getReorderListService = async (userId, query = {}) => {
  const days = clampInt(query.days, 14, MAX_HISTORY_DAYS, DEFAULT_HISTORY_DAYS);
  const limit = clampInt(query.limit, 1, MAX_REORDER_LIST_ITEMS, 20);
  const orders = await getHistoryOrders(userId, days);

  if (!orders.length) {
    return {
      historyDays: days,
      items: [],
      usuallyBoughtThisWeek: [],
    };
  }

  const nowWeekday = weekdayInAppTimezone(new Date());
  const aggregate = new Map();
  const today = Date.now();

  for (const order of orders) {
    const orderWeekday = order.deliveryDateKey
      ? weekdayInAppTimezone(new Date(`${order.deliveryDateKey}T12:00:00.000Z`))
      : weekdayInAppTimezone(order.createdAt);
    const matchesCurrentWeekday = orderWeekday === nowWeekday;

    for (const item of order.items || []) {
      const productId = String(item.productId);
      const previous = aggregate.get(productId) || {
        productId,
        name: item.productName,
        image: item.image || null,
        sku: item.sku,
        unit: "",
        mrp: Number(item.price) || 0,
        sellingPrice: Number(item.price) || 0,
        totalQuantity: 0,
        orderCount: 0,
        matchingWeekdayCount: 0,
        lastOrderedAt: order.createdAt,
        lastQuantity: Number(item.quantity) || 1,
        lastSeenAtMs: today,
      };

      previous.totalQuantity += Number(item.quantity) || 0;
      previous.orderCount += 1;
      if (matchesCurrentWeekday) previous.matchingWeekdayCount += 1;

      if (new Date(order.createdAt).getTime() > new Date(previous.lastOrderedAt).getTime()) {
        previous.lastOrderedAt = order.createdAt;
        previous.lastQuantity = Number(item.quantity) || 1;
        previous.name = item.productName || previous.name;
        previous.image = item.image || previous.image;
        previous.sku = item.sku || previous.sku;
      }

      aggregate.set(productId, previous);
    }
  }

  const ids = [...aggregate.keys()].filter((id) => mongoose.Types.ObjectId.isValid(id));
  const [products, inventories] = await Promise.all([
    Product.find({ _id: { $in: ids } })
      .select("name images sellingPrice mrp unit sku isActive isDeleted")
      .lean(),
    Inventory.find({ productId: { $in: ids } })
      .select("productId availableStock status")
      .lean(),
  ]);

  const productMap = new Map(products.map((product) => [String(product._id), product]));
  const inventoryMap = new Map(inventories.map((inventory) => [String(inventory.productId), inventory]));

  const items = [...aggregate.values()]
    .map((entry) => {
      const product = productMap.get(entry.productId);
      const inventory = inventoryMap.get(entry.productId);
      const availableStock = Number(inventory?.availableStock ?? 0);
      const isAvailable = Boolean(product && !product.isDeleted && product.isActive !== false && availableStock > 0);
      const lastOrderedMs = new Date(entry.lastOrderedAt).getTime();
      const daysSinceLastOrder = Number.isFinite(lastOrderedMs)
        ? Math.max(0, Math.floor((today - lastOrderedMs) / (24 * 60 * 60 * 1000)))
        : null;

      return {
        productId: entry.productId,
        name: product?.name || entry.name || "Product",
        image: productImage(product) || entry.image,
        sku: product?.sku || entry.sku || "",
        unit: product?.unit || entry.unit || "",
        mrp: Number(product?.mrp ?? entry.mrp ?? 0),
        price: Number(product?.sellingPrice ?? entry.sellingPrice ?? entry.mrp ?? 0),
        availableStock,
        isAvailable,
        orderCount: entry.orderCount,
        totalQuantity: entry.totalQuantity,
        averageQuantity: Math.max(1, Math.round(entry.totalQuantity / entry.orderCount)),
        lastQuantity: Math.max(1, entry.lastQuantity),
        lastOrderedAt: entry.lastOrderedAt,
        daysSinceLastOrder,
        usuallyBoughtThisWeek: entry.matchingWeekdayCount >= 2,
        matchingWeekdayCount: entry.matchingWeekdayCount,
        reason:
          entry.matchingWeekdayCount >= 2
            ? `Bought ${entry.matchingWeekdayCount} times on ${nowWeekday} recently`
            : `Bought ${entry.orderCount} time${entry.orderCount === 1 ? "" : "s"} in the last ${days} days`,
      };
    })
    .sort((a, b) => {
      if (a.usuallyBoughtThisWeek !== b.usuallyBoughtThisWeek) return a.usuallyBoughtThisWeek ? -1 : 1;
      if (b.orderCount !== a.orderCount) return b.orderCount - a.orderCount;
      return new Date(b.lastOrderedAt).getTime() - new Date(a.lastOrderedAt).getTime();
    });

  return {
    historyDays: days,
    items: items.slice(0, limit),
    usuallyBoughtThisWeek: items.filter((item) => item.usuallyBoughtThisWeek).slice(0, Math.min(10, limit)),
  };
};

const normalizeRequestedItems = ({ mode, sourceOrder, items }) => {
  if (sourceOrder) {
    const sourceItems = sourceOrder.items || [];
    if (mode === "ALL") {
      return sourceItems.map((item) => ({
        productId: String(item.productId),
        quantity: Number(item.quantity) || 1,
      }));
    }

    const requested = new Map(
      (items || []).map((item) => [String(item.productId), Number(item.quantity) || 1])
    );

    return sourceItems
      .filter((item) => requested.has(String(item.productId)))
      .map((item) => ({
        productId: String(item.productId),
        quantity: requested.get(String(item.productId)) || Number(item.quantity) || 1,
      }));
  }

  return (items || []).map((item) => ({
    productId: String(item.productId),
    quantity: Number(item.quantity) || 1,
  }));
};

export const reorderToCartService = async (userId, body = {}) => {
  const mode = String(body.mode || "").toUpperCase();
  if (!['ALL', 'SELECTED'].includes(mode)) {
    throw new AppError(400, "INVALID_REORDER_MODE", "Reorder mode must be ALL or SELECTED");
  }

  let sourceOrder = null;
  if (body.sourceOrderId) {
    sourceOrder = await Order.findOne({
      _id: toObjectId(body.sourceOrderId, "sourceOrderId"),
      userId,
      isDeleted: false,
      orderStatus: "DELIVERED",
    })
      .select("items")
      .lean();

    if (!sourceOrder) {
      throw new AppError(404, "SOURCE_ORDER_NOT_FOUND", "Order not found or cannot be reordered");
    }
  }

  if (!sourceOrder && mode === "ALL") {
    throw new AppError(400, "SOURCE_ORDER_REQUIRED", "sourceOrderId is required for Buy Again all");
  }

  const requested = normalizeRequestedItems({ mode, sourceOrder, items: body.items });
  if (!requested.length) {
    throw new AppError(400, "REORDER_ITEMS_REQUIRED", "Select at least one item to reorder");
  }

  const uniqueMap = new Map();
  for (const item of requested) {
    if (!mongoose.Types.ObjectId.isValid(item.productId)) continue;
    const quantity = Math.min(MAX_REORDER_QUANTITY, Math.max(1, Number(item.quantity) || 1));
    uniqueMap.set(item.productId, Math.min(MAX_REORDER_QUANTITY, (uniqueMap.get(item.productId) || 0) + quantity));
  }

  const productIds = [...uniqueMap.keys()].map((id) => new mongoose.Types.ObjectId(id));
  if (!productIds.length) {
    throw new AppError(400, "REORDER_ITEMS_REQUIRED", "Select at least one valid product");
  }

  const [products, inventories] = await Promise.all([
    Product.find({ _id: { $in: productIds }, isDeleted: false, isActive: true })
      .select("name images sku sellingPrice mrp unit stock")
      .lean(),
    Inventory.find({ productId: { $in: productIds } })
      .select("productId availableStock status")
      .lean(),
  ]);

  const productMap = new Map(products.map((product) => [String(product._id), product]));
  const inventoryMap = new Map(inventories.map((inventory) => [String(inventory.productId), inventory]));

  let cart = await Cart.findOne({ userId });
  if (!cart) cart = await Cart.create({ userId, items: [] });

  const added = [];
  const skipped = [];

  for (const [productId, requestedQuantity] of uniqueMap.entries()) {
    const product = productMap.get(productId);
    const inventory = inventoryMap.get(productId);

    if (!product) {
      skipped.push({ productId, reason: "Product is no longer available" });
      continue;
    }

    const availableStock = Number(inventory?.availableStock ?? 0);
    if (!inventory || availableStock <= 0) {
      skipped.push({ productId, name: product.name, reason: "Currently out of stock" });
      continue;
    }

    const existingItem = cart.items.find((item) => String(item.productId) === productId);
    const currentQuantity = existingItem ? Number(existingItem.quantity) : 0;
    const desiredQuantity = currentQuantity + requestedQuantity;

    if (desiredQuantity > availableStock) {
      skipped.push({
        productId,
        name: product.name,
        reason: `Only ${availableStock} available${currentQuantity ? ` (${currentQuantity} already in cart)` : ""}`,
      });
      continue;
    }

    if (existingItem) {
      existingItem.quantity = desiredQuantity;
      existingItem.price = Number(product.sellingPrice);
      existingItem.subtotal = desiredQuantity * Number(product.sellingPrice);
      added.push({ productId, name: product.name, quantity: requestedQuantity });
    } else {
      cart.items.push({
        productId: product._id,
        quantity: requestedQuantity,
        price: Number(product.sellingPrice),
        subtotal: requestedQuantity * Number(product.sellingPrice),
        substitutionPreference: buildSourcePreference(),
      });
      added.push({ productId, name: product.name, quantity: requestedQuantity });
    }
  }

  if (!added.length) {
    throw new AppError(409, "NO_REORDERABLE_ITEMS", "None of the selected items are currently available");
  }

  cart.calculateTotals();
  await cart.save();

  const populatedCart = await Cart.findOne({ userId }).populate({
    path: "items.productId",
    select: "name images sellingPrice mrp unit sku stock isActive categoryId",
  });

  return {
    added,
    skipped,
    cart: populatedCart,
    summary: {
      addedCount: added.length,
      skippedCount: skipped.length,
    },
  };
};
