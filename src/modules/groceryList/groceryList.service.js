import mongoose from "mongoose";
import GroceryList from "./groceryList.model.js";
import Product from "../product/product.model.js";
import Inventory from "../inventory/inventory.model.js";
import Cart from "../cart/cart.model.js";
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
export const createSmartWeeklyListService = async (userId) => {
  const smart = await getReorderListService(userId, { days: 90, limit: 40 });
  const candidates = smart.usuallyBoughtThisWeek?.length ? smart.usuallyBoughtThisWeek : (smart.items || []).filter((item) => item.orderCount >= 2).slice(0, 12);
  if (!candidates.length) throw new AppError(409, "SMART_LIST_NOT_READY", "We need a little more order history to build your smart weekly list");
  const items = candidates.filter((item) => item.isAvailable).slice(0, MAX_ITEMS).map((item) => ({ productId: item.productId, quantity: item.lastQuantity || item.averageQuantity || 1 }));
  if (!items.length) throw new AppError(409, "SMART_LIST_NO_AVAILABLE_ITEMS", "Your usual weekly products are currently unavailable");
  const existing = await GroceryList.findOne({ userId, listType: "WEEKLY_ESSENTIALS" });
  if (existing) {
    existing.items = normalizeItems(items); existing.name = "Weekly Essentials"; existing.description = "Smartly built from your recent weekly shopping pattern"; existing.repeatInterval = "WEEKLY"; existing.isPinned = true; await existing.save();
    return { list: (await hydrateLists([existing.toObject()]))[0], created: false, source: "purchase-pattern" };
  }
  return { list: await createGroceryListService(userId, { name: "Weekly Essentials", description: "Smartly built from your recent weekly shopping pattern", listType: "WEEKLY_ESSENTIALS", repeatInterval: "WEEKLY", isPinned: true, items }), created: true, source: "purchase-pattern" };
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
