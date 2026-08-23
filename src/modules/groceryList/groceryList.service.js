import mongoose from "mongoose";
import GroceryList from "./groceryList.model.js";
import Product from "../product/product.model.js";
import Inventory from "../inventory/inventory.model.js";
import Cart from "../cart/cart.model.js";
import Profile from "../profile/profile.model.js";
import AppError from "../../utils/AppError.js";
import { getReorderListService } from "../order/reorder.service.js";

const MAX_ITEMS = 40;
const MAX_QUANTITY = 50;
const PRODUCT_SELECT = "name images sellingPrice mrp unit sku stock isActive isDeleted categoryId";
const toId = (value, field = "id") => {
  if (!mongoose.Types.ObjectId.isValid(value)) throw new AppError(400, "INVALID_ID", `Invalid ${field}`);
  return new mongoose.Types.ObjectId(value);
};
const normalizeItems = (items = []) => {
  const map = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    if (!mongoose.Types.ObjectId.isValid(item?.productId)) continue;
    const id = String(item.productId);
    const qty = Math.min(MAX_QUANTITY, Math.max(1, Number(item.quantity) || 1));
    map.set(id, Math.min(MAX_QUANTITY, (map.get(id) || 0) + qty));
  }
  return [...map.entries()].slice(0, MAX_ITEMS).map(([productId, quantity]) => ({ productId: new mongoose.Types.ObjectId(productId), quantity }));
};
const hydrateLists = async (lists) => {
  const ids = [...new Set(lists.flatMap((list) => list.items.map((item) => String(item.productId))))].filter(mongoose.Types.ObjectId.isValid);
  const [products, inventories] = await Promise.all([
    Product.find({ _id: { $in: ids } }).select(PRODUCT_SELECT).lean(),
    Inventory.find({ productId: { $in: ids } }).select("productId availableStock status").lean(),
  ]);
  const productMap = new Map(products.map((p) => [String(p._id), p]));
  const inventoryMap = new Map(inventories.map((i) => [String(i.productId), i]));
  return lists.map((list) => ({ ...list, items: list.items.map((item) => {
    const id = String(item.productId), product = productMap.get(id), inventory = inventoryMap.get(id), availableStock = Number(inventory?.availableStock ?? 0);
    return { productId: id, quantity: Number(item.quantity) || 1, product: product ? { id, name: product.name, image: product.images?.[0] || null, price: Number(product.sellingPrice || 0), mrp: Number(product.mrp || 0), unit: product.unit || "", sku: product.sku || "" } : null, availableStock, isAvailable: Boolean(product && !product.isDeleted && product.isActive !== false && availableStock > 0) };
  }) }));
};
const getUserList = async (userId, id) => {
  const list = await GroceryList.findOne({ _id: toId(id, "grocery list"), userId }).lean();
  if (!list) throw new AppError(404, "GROCERY_LIST_NOT_FOUND", "Grocery list not found");
  return list;
};
export const getMyGroceryListsService = async (userId) => hydrateLists(await GroceryList.find({ userId }).sort({ isPinned: -1, updatedAt: -1 }).lean());
export const createGroceryListService = async (userId, body = {}) => {
  const items = normalizeItems(body.items);
  if (!items.length) throw new AppError(400, "GROCERY_LIST_ITEMS_REQUIRED", "Add at least one product to the list");
  const listType = body.listType === "WEEKLY_ESSENTIALS" ? "WEEKLY_ESSENTIALS" : "CUSTOM";
  const list = await GroceryList.create({ userId, name: String(body.name || "Weekly Essentials").trim(), description: String(body.description || "").trim(), listType, repeatInterval: listType === "WEEKLY_ESSENTIALS" ? "WEEKLY" : body.repeatInterval || "NONE", isPinned: Boolean(body.isPinned), items });
  return (await hydrateLists([list.toObject()]))[0];
};
export const createGroceryListFromCartService = async (userId, body = {}) => {
  const cart = await Cart.findOne({ userId }).select("items").lean();
  if (!cart?.items?.length) throw new AppError(409, "CART_EMPTY", "Your cart is empty");
  const items = normalizeItems(cart.items.map((item) => ({ productId: String(item.productId), quantity: Number(item.quantity) || 1 })));
  const existing = await GroceryList.findOne({ userId, listType: "WEEKLY_ESSENTIALS" });
  if (existing) {
    existing.name = String(body.name || "Weekly Essentials").trim();
    existing.description = String(body.description || "Your saved weekly grocery basket").trim();
    existing.repeatInterval = "WEEKLY";
    existing.isPinned = body.isPinned !== false;
    existing.items = items;
    await existing.save();
    return (await hydrateLists([existing.toObject()]))[0];
  }
  return createGroceryListService(userId, { name: String(body.name || "Weekly Essentials").trim(), description: body.description || "Your saved weekly grocery basket", listType: "WEEKLY_ESSENTIALS", repeatInterval: "WEEKLY", isPinned: body.isPinned !== false, items });
};
const SMART_SEASON_RULES = {
  // Broad, India-friendly seasonality hints. Products are only rewarded when
  // their existing tags/name/category match; nothing is invented.
  summer: {
    months: [3, 4, 5, 6],
    terms: ["mango", "watermelon", "melon", "cucumber", "lemon", "mint", "curd", "juice"],
  },
  monsoon: {
    months: [6, 7, 8, 9],
    terms: ["ginger", "turmeric", "tea", "coffee", "corn", "pakora"],
  },
  winter: {
    months: [11, 12, 1, 2],
    terms: ["carrot", "peas", "cauliflower", "spinach", "beet", "orange", "apple", "radish"],
  },
};

const getPreferenceValues = (preferences = {}) => {
  const source = preferences && typeof preferences === "object" ? preferences : {};
  const read = (...keys) => keys.flatMap((key) => {
    const value = source[key];
    if (Array.isArray(value)) return value;
    if (typeof value === "string") return value.split(",").map((item) => item.trim());
    return [];
  }).filter(Boolean).map((value) => String(value).trim().toLowerCase());

  return {
    preferredCategories: read("preferredCategories", "favoriteCategories", "categories"),
    preferredBrands: read("preferredBrands", "favoriteBrands", "brands"),
    preferredTags: read("preferredTags", "dietaryPreferences", "dietaryTags", "tags"),
    dislikedTags: read("dislikedTags", "avoidTags", "excludedTags"),
  };
};

const buildSmartBasket = ({ reorder, products, preferences }) => {
  const preference = getPreferenceValues(preferences);
  const productMap = new Map(products.map((product) => [String(product._id), product]));
  const now = new Date();
  const month = now.getMonth() + 1;
  const activeSeasons = Object.values(SMART_SEASON_RULES).filter((rule) => rule.months.includes(month));

  const scored = reorder.items
    .map((item) => {
      const product = productMap.get(String(item.productId));
      const searchable = [
        product?.name,
        product?.categoryId?.name,
        ...(product?.tags || []),
        product?.brand,
      ].filter(Boolean).join(" ").toLowerCase();

      let score = 0;
      const reasons = [];

      // 1. Proven personal behaviour is the strongest signal.
      score += Math.min(30, item.orderCount * 4);
      if (item.usuallyBoughtThisWeek) {
        score += 25;
        reasons.push("usually bought around this time");
      } else if (item.orderCount >= 2) {
        reasons.push(`bought ${item.orderCount} times recently`);
      }

      if (item.daysSinceLastOrder != null && item.daysSinceLastOrder <= 14) {
        score += 8;
        reasons.push("recently purchased");
      }

      // 2. Household/profile preferences are optional and transparent.
      if (preference.preferredCategories.some((value) => searchable.includes(value))) {
        score += 10;
        reasons.push("matches your preferences");
      }
      if (preference.preferredBrands.some((value) => searchable.includes(value))) {
        score += 8;
        reasons.push("matches a preferred brand");
      }
      if (preference.preferredTags.some((value) => searchable.includes(value))) {
        score += 8;
        reasons.push("matches your saved preferences");
      }
      if (preference.dislikedTags.some((value) => searchable.includes(value))) {
        score -= 35;
        reasons.push("matches an item you asked us to avoid");
      }

      // 3. Existing catalog tags and simple month-based seasonality.
      if ((product?.tags || []).some((tag) => String(tag).toLowerCase() === "seasonal")) {
        score += 6;
        reasons.push("seasonal item");
      }
      if (activeSeasons.some((season) => season.terms.some((term) => searchable.includes(term)))) {
        score += 5;
        reasons.push("fits the current season");
      }

      // 4. Live availability matters: unavailable items never enter the basket.
      if (item.isAvailable) score += 5;
      else score -= 100;

      return {
        ...item,
        smartScore: score,
        smartReasons: [...new Set(reasons)].slice(0, 3),
      };
    })
    .filter((item) => item.isAvailable && item.smartScore > 0)
    .sort((a, b) => {
      if (b.smartScore !== a.smartScore) return b.smartScore - a.smartScore;
      if (b.orderCount !== a.orderCount) return b.orderCount - a.orderCount;
      return new Date(b.lastOrderedAt).getTime() - new Date(a.lastOrderedAt).getTime();
    });

  return scored.slice(0, MAX_ITEMS);
};

export const createSmartWeeklyListService = async (userId) => {
  const [smart, profile] = await Promise.all([
    getReorderListService(userId, { days: 90, limit: 40 }),
    Profile.findOne({ userId }).select("preferences").lean(),
  ]);

  if (!smart.items?.length) {
    throw new AppError(
      409,
      "SMART_LIST_NOT_READY",
      "We need a little more order history to build your smart weekly list",
    );
  }

  const productIds = smart.items
    .map((item) => item.productId)
    .filter((id) => mongoose.Types.ObjectId.isValid(id));

  const products = await Product.find({ _id: { $in: productIds }, isDeleted: false, isActive: true })
    .populate("categoryId", "name")
    .select("name tags brand categoryId")
    .lean();

  const candidates = buildSmartBasket({
    reorder: smart,
    products,
    preferences: profile?.preferences || {},
  });

  if (!candidates.length) {
    throw new AppError(
      409,
      "SMART_LIST_NO_AVAILABLE_ITEMS",
      "Your usual products are currently unavailable. Try again after restocking.",
    );
  }

  const items = candidates.slice(0, MAX_ITEMS).map((item) => ({
    productId: item.productId,
    quantity: Math.max(1, Math.min(MAX_QUANTITY, item.lastQuantity || item.averageQuantity || 1)),
  }));

  const existing = await GroceryList.findOne({ userId, listType: "WEEKLY_ESSENTIALS" });
  const description = "Built from your recent purchases, preferences, seasonality and live stock. You can edit it anytime.";

  if (existing) {
    existing.items = normalizeItems(items);
    existing.name = "Smart Weekly Essentials";
    existing.description = description;
    existing.repeatInterval = "WEEKLY";
    existing.isPinned = true;
    await existing.save();

    return {
      list: (await hydrateLists([existing.toObject()]))[0],
      created: false,
      source: "deterministic-personalization",
      generatedAt: new Date().toISOString(),
      rules: {
        purchaseHistory: true,
        weekdayPattern: true,
        preferences: Boolean(Object.keys(profile?.preferences || {}).length),
        seasonality: true,
        liveStock: true,
        ai: false,
      },
      insights: candidates.slice(0, 8).map((item) => ({
        productId: item.productId,
        name: item.name,
        score: item.smartScore,
        reasons: item.smartReasons,
      })),
    };
  }

  return {
    list: await createGroceryListService(userId, {
      name: "Smart Weekly Essentials",
      description,
      listType: "WEEKLY_ESSENTIALS",
      repeatInterval: "WEEKLY",
      isPinned: true,
      items,
    }),
    created: true,
    source: "deterministic-personalization",
    generatedAt: new Date().toISOString(),
    rules: {
      purchaseHistory: true,
      weekdayPattern: true,
      preferences: Boolean(Object.keys(profile?.preferences || {}).length),
      seasonality: true,
      liveStock: true,
      ai: false,
    },
    insights: candidates.slice(0, 8).map((item) => ({
      productId: item.productId,
      name: item.name,
      score: item.smartScore,
      reasons: item.smartReasons,
    })),
  };
};

export const updateGroceryListService = async (userId, id, body = {}) => {
  const list = await getUserList(userId, id);
  if (body.name !== undefined) list.name = String(body.name).trim();
  if (body.description !== undefined) list.description = String(body.description || "").trim();
  if (body.listType !== undefined) list.listType = body.listType;
  if (body.repeatInterval !== undefined) list.repeatInterval = body.repeatInterval;
  if (body.isPinned !== undefined) list.isPinned = Boolean(body.isPinned);
  if (body.items !== undefined) { const items = normalizeItems(body.items); if (!items.length) throw new AppError(400, "GROCERY_LIST_ITEMS_REQUIRED", "A list must contain at least one product"); list.items = items; }
  if (list.listType === "WEEKLY_ESSENTIALS") list.repeatInterval = "WEEKLY";
  await GroceryList.updateOne({ _id: list._id, userId }, { $set: { name: list.name, description: list.description, listType: list.listType, repeatInterval: list.repeatInterval, isPinned: list.isPinned, items: list.items } });
  return (await hydrateLists([await GroceryList.findById(list._id).lean()]))[0];
};
export const deleteGroceryListService = async (userId, id) => { const result = await GroceryList.deleteOne({ _id: toId(id, "grocery list"), userId }); if (!result.deletedCount) throw new AppError(404, "GROCERY_LIST_NOT_FOUND", "Grocery list not found"); };
export const addGroceryListToCartService = async (userId, id) => {
  const list = await getUserList(userId, id);
  if (!list.items.length) throw new AppError(409, "GROCERY_LIST_EMPTY", "This grocery list is empty");
  const ids = list.items.map((item) => item.productId);
  const [products, inventories] = await Promise.all([Product.find({ _id: { $in: ids }, isDeleted: false, isActive: true }).select(PRODUCT_SELECT).lean(), Inventory.find({ productId: { $in: ids } }).select("productId availableStock").lean()]);
  const productMap = new Map(products.map((p) => [String(p._id), p])), inventoryMap = new Map(inventories.map((i) => [String(i.productId), i]));
  let cart = await Cart.findOne({ userId }); if (!cart) cart = await Cart.create({ userId, items: [] });
  const added = [], skipped = [];
  for (const item of list.items) {
    const productId = String(item.productId), product = productMap.get(productId), inventory = inventoryMap.get(productId);
    if (!product) { skipped.push({ productId, reason: "Product is no longer available" }); continue; }
    const availableStock = Number(inventory?.availableStock ?? 0);
    if (availableStock <= 0) { skipped.push({ productId, name: product.name, reason: "Currently out of stock" }); continue; }
    const requested = Math.min(MAX_QUANTITY, Math.max(1, Number(item.quantity) || 1));
    const existing = cart.items.find((entry) => String(entry.productId) === productId), current = existing ? Number(existing.quantity) : 0, room = Math.max(0, availableStock - current);
    if (room <= 0) { skipped.push({ productId, name: product.name, reason: `Only ${availableStock} available and it is already in your cart` }); continue; }
    const qty = Math.min(requested, room);
    if (existing) { existing.quantity = current + qty; existing.price = Number(product.sellingPrice); existing.subtotal = existing.quantity * Number(product.sellingPrice); }
    else cart.items.push({ productId: product._id, quantity: qty, price: Number(product.sellingPrice), subtotal: qty * Number(product.sellingPrice), substitutionPreference: { type: "CALL_ME", preferredReplacementProductId: null } });
    added.push({ productId, name: product.name, quantity: qty }); if (qty < requested) skipped.push({ productId, name: product.name, reason: `Only ${availableStock} available` });
  }
  if (!added.length) throw new AppError(409, "NO_GROCERY_LIST_ITEMS_AVAILABLE", "None of the list items are currently available");
  cart.calculateTotals(); await cart.save(); await GroceryList.updateOne({ _id: list._id }, { $set: { lastAddedToCartAt: new Date() } });
  const populatedCart = await Cart.findOne({ userId }).populate({ path: "items.productId", select: PRODUCT_SELECT });
  return { added, skipped, cart: populatedCart, summary: { addedCount: added.length, skippedCount: skipped.length } };
};
export const getAdminGroceryListSummaryService = async (query = {}) => {
  const limit = Math.min(200, Math.max(1, Number(query.limit) || 100));
  const [totalLists, pinnedLists, weeklyLists, itemAgg, totalItemsAgg] = await Promise.all([
    GroceryList.countDocuments(), GroceryList.countDocuments({ isPinned: true }), GroceryList.countDocuments({ listType: "WEEKLY_ESSENTIALS" }),
    GroceryList.aggregate([{ $unwind: "$items" }, { $group: { _id: "$items.productId", lists: { $sum: 1 }, quantity: { $sum: "$items.quantity" } } }, { $sort: { lists: -1, quantity: -1 } }, { $limit: limit }, { $lookup: { from: "products", localField: "_id", foreignField: "_id", as: "product" } }, { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } }, { $project: { productId: "$_id", name: "$product.name", image: { $arrayElemAt: ["$product.images", 0] }, sellingPrice: "$product.sellingPrice", lists: 1, quantity: 1 } }]),
    GroceryList.aggregate([{ $project: { count: { $size: "$items" } } }, { $group: { _id: null, total: { $sum: "$count" } } }]),
  ]);
  return { totalLists, pinnedLists, weeklyLists, totalItems: Number(totalItemsAgg[0]?.total || 0), topProducts: itemAgg };
};
export const getAdminGroceryListsService = async (query = {}) => GroceryList.find().populate("userId", "name email phone").populate("items.productId", "name images sellingPrice mrp unit sku isActive isDeleted").sort({ isPinned: -1, updatedAt: -1 }).limit(Math.min(200, Math.max(1, Number(query.limit) || 100))).lean();
