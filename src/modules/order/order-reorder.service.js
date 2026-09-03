import Cart from "../cart/cart.model.js";
import Product from "../product/product.model.js";
import Inventory from "../inventory/inventory.model.js";
import Order from "./order.model.js";
import AppError from "../../utils/AppError.js";

const HISTORY_DAYS = 90;

const startOfDay = (date) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
};

const daysAgo = (days) => {
  const value = startOfDay(new Date());
  value.setDate(value.getDate() - days);
  return value;
};

const normalizeQuantity = (value) => Math.max(1, Math.min(50, Math.floor(Number(value) || 1)));

const productIdOf = (value) => String(value?._id ?? value);

const getRecentOrderItems = async (userId, query = {}) => {
  const days = Math.min(365, Math.max(1, Number(query.days) || HISTORY_DAYS));
  const limit = Math.min(500, Math.max(1, Number(query.limit) || 40));
  const since = daysAgo(days);

  const orders = await Order.find({
    userId,
    isDeleted: false,
    orderStatus: "DELIVERED",
    createdAt: { $gte: since },
  })
    .select("items createdAt orderNumber")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return { orders, days };
};

export const getReorderListService = async (userId, query = {}) => {
  const { orders, days } = await getRecentOrderItems(userId, query);
  const stats = new Map();
  const now = new Date();
  const todayDay = now.getDay();

  for (const order of orders) {
    const orderDate = new Date(order.createdAt);
    const weekdayMatch = orderDate.getDay() === todayDay;
    const daysSince = Math.max(
      0,
      Math.floor((startOfDay(now).getTime() - startOfDay(orderDate).getTime()) / 86400000),
    );

    for (const item of order.items || []) {
      const productId = productIdOf(item.productId);
      if (!stats.has(productId)) {
        stats.set(productId, {
          productId,
          orderCount: 0,
          totalQuantity: 0,
          quantities: [],
          lastQuantity: normalizeQuantity(item.quantity),
          lastOrderedAt: order.createdAt,
          daysSinceLastOrder: daysSince,
          matchingWeekdayCount: 0,
        });
      }

      const row = stats.get(productId);
      row.orderCount += 1;
      row.totalQuantity += normalizeQuantity(item.quantity);
      row.quantities.push(normalizeQuantity(item.quantity));
      if (weekdayMatch) row.matchingWeekdayCount += 1;
    }
  }

  const productIds = [...stats.keys()];
  if (!productIds.length) {
    return { historyDays: days, items: [], usuallyBoughtThisWeek: [] };
  }

  const [products, inventoryRows] = await Promise.all([
    Product.find({ _id: { $in: productIds }, isDeleted: false })
      .select("name images sku unit mrp sellingPrice isActive isDeleted")
      .lean(),
    Inventory.find({ productId: { $in: productIds } })
      .select("productId availableStock")
      .lean(),
  ]);

  const productMap = new Map(products.map((product) => [String(product._id), product]));
  const inventoryMap = new Map(inventoryRows.map((row) => [String(row.productId), row]));

  const items = [...stats.values()]
    .map((row) => {
      const product = productMap.get(row.productId);
      const inventory = inventoryMap.get(row.productId);
      if (!product) return null;

      const averageQuantity = row.totalQuantity / Math.max(1, row.orderCount);
      const availableStock = Math.max(0, Number(inventory?.availableStock || 0));
      const isAvailable = Boolean(product.isActive !== false && !product.isDeleted && availableStock > 0);
      const usuallyBoughtThisWeek = row.matchingWeekdayCount > 0 && row.daysSinceLastOrder <= 21;

      return {
        productId: row.productId,
        name: product.name,
        image: product.images?.[0] || null,
        sku: product.sku,
        unit: product.unit || "",
        mrp: Number(product.mrp || 0),
        price: Number(product.sellingPrice || 0),
        availableStock,
        isAvailable,
        orderCount: row.orderCount,
        totalQuantity: row.totalQuantity,
        averageQuantity: Number(averageQuantity.toFixed(2)),
        lastQuantity: row.lastQuantity,
        lastOrderedAt: row.lastOrderedAt,
        daysSinceLastOrder: row.daysSinceLastOrder,
        usuallyBoughtThisWeek,
        matchingWeekdayCount: row.matchingWeekdayCount,
        reason: usuallyBoughtThisWeek
          ? `Bought ${row.matchingWeekdayCount}× on this weekday recently`
          : `Bought ${row.orderCount}× in the last ${days} days`,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.usuallyBoughtThisWeek !== b.usuallyBoughtThisWeek) return a.usuallyBoughtThisWeek ? -1 : 1;
      if (b.orderCount !== a.orderCount) return b.orderCount - a.orderCount;
      return new Date(b.lastOrderedAt).getTime() - new Date(a.lastOrderedAt).getTime();
    });

  return {
    historyDays: days,
    items,
    usuallyBoughtThisWeek: items.filter((item) => item.usuallyBoughtThisWeek),
  };
};

const resolveSelectedItems = async (userId, body) => {
  const mode = body?.mode === "ALL" ? "ALL" : "SELECTED";
  if (mode === "SELECTED") {
    return Array.isArray(body.items)
      ? body.items
          .filter((item) => item?.productId)
          .slice(0, 40)
          .map((item) => ({
            productId: String(item.productId),
            quantity: normalizeQuantity(item.quantity),
          }))
      : [];
  }

  const list = await getReorderListService(userId, { days: HISTORY_DAYS, limit: 100 });
  return list.items
    .filter((item) => item.isAvailable)
    .map((item) => ({
      productId: item.productId,
      quantity: item.lastQuantity,
    }));
};

export const reorderToCartService = async (userId, body = {}) => {
  const requested = await resolveSelectedItems(userId, body);
  if (!requested.length) {
    throw new AppError(400, "REORDER_ITEMS_REQUIRED", "Select at least one product to reorder");
  }

  let cart = await Cart.findOne({ userId });
  if (!cart) cart = await Cart.create({ userId, items: [] });

  const added = [];
  const skipped = [];

  for (const request of requested) {
    const quantity = normalizeQuantity(request.quantity);
    const product = await Product.findOne({
      _id: request.productId,
      isDeleted: false,
      isActive: true,
    }).select("name sellingPrice mrp unit sku categoryId images");

    if (!product) {
      skipped.push({ productId: request.productId, name: "", reason: "PRODUCT_UNAVAILABLE" });
      continue;
    }

    const inventory = await Inventory.findOne({ productId: product._id }).select("availableStock");
    const availableStock = Math.max(0, Number(inventory?.availableStock || 0));
    if (availableStock < quantity) {
      skipped.push({ productId: String(product._id), name: product.name, reason: "INSUFFICIENT_STOCK" });
      continue;
    }

    const existing = cart.items.find((item) => productIdOf(item.productId) === String(product._id));
    const nextQuantity = (existing?.quantity || 0) + quantity;
    if (nextQuantity > availableStock) {
      skipped.push({ productId: String(product._id), name: product.name, reason: "CART_STOCK_LIMIT" });
      continue;
    }

    if (existing) {
      existing.quantity = nextQuantity;
      existing.price = Number(product.sellingPrice);
      existing.subtotal = Number((nextQuantity * Number(product.sellingPrice)).toFixed(2));
    } else {
      cart.items.push({
        productId: product._id,
        quantity,
        price: Number(product.sellingPrice),
        subtotal: Number((quantity * Number(product.sellingPrice)).toFixed(2)),
        substitutionPreference: {
          type: "CALL_ME",
          preferredReplacementProductId: null,
        },
      });
    }

    added.push({ productId: String(product._id), name: product.name, quantity });
  }

  cart.calculateTotals();
  await cart.save();

  const populated = await Cart.findOne({ userId }).populate({
    path: "items.productId",
    select: "name images sellingPrice mrp unit sku stock isActive categoryId",
  });

  return {
    added,
    skipped,
    cart: populated,
    summary: {
      addedCount: added.length,
      skippedCount: skipped.length,
    },
  };
};
