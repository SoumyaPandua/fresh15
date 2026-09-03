import crypto from "node:crypto";
import Product from "../product/product.model.js";
import Inventory from "../inventory/inventory.model.js";
import Order from "../order/order.model.js";
import Wishlist from "../wishlist/wishlist.model.js";
import Offer from "../offer/offer.model.js";

const STOP = new Set(["the","and","for","with","from","fresh","item","items","pack","kg","g","ml","l","of","to"]);
const clamp = (n, min, max) => Math.max(min, Math.min(max, Number(n) || 0));
const tokens = (value) => String(value || "").toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}\s-]/gu, " ").split(/\s+/).filter((x) => x && !STOP.has(x));
const makeRequestId = () => crypto.randomUUID();

const seasonTokensByMonth = {
  1: ["orange","carrot","peas","spinach"],
  2: ["orange","carrot","peas","spinach"],
  3: ["mango","cucumber","watermelon","lemon"],
  4: ["mango","watermelon","cucumber","lemon"],
  5: ["mango","watermelon","coconut","lemon"],
  6: ["mango","watermelon","corn","coconut"],
  7: ["corn","coconut","ginger","turmeric"],
  8: ["banana","corn","ginger","leaf"],
  9: ["banana","apple","pomegranate","leaf"],
  10: ["apple","pomegranate","carrot","leaf"],
  11: ["apple","pomegranate","orange","carrot"],
  12: ["orange","apple","carrot","peas"],
};

const loadProfile = async (userId) => {
  const since = new Date(Date.now() - 180 * 86400000);
  const [orders, wishlist] = await Promise.all([
    Order.find({
      userId,
      isDeleted: false,
      orderStatus: "DELIVERED",
      createdAt: { $gte: since },
    }).select("items createdAt").sort({ createdAt: -1 }).limit(100).lean(),
    Wishlist.findOne({ userId }).select("items").lean(),
  ]);

  const purchaseOrders = new Map();
  const purchaseUnits = new Map();
  const lastPurchasedAt = new Map();

  for (const order of orders) {
    for (const item of order.items || []) {
      const productId = String(item.productId);
      purchaseOrders.set(productId, (purchaseOrders.get(productId) || 0) + 1);
      purchaseUnits.set(productId, (purchaseUnits.get(productId) || 0) + Number(item.quantity || 1));
      lastPurchasedAt.set(productId, lastPurchasedAt.get(productId) || order.createdAt);
    }
  }

  return {
    purchaseOrders,
    purchaseUnits,
    lastPurchasedAt,
    wishlistIds: new Set((wishlist?.items || []).map((item) => String(item.productId))),
  };
};

const fetchInventoryMap = async (products) => {
  if (!products.length) return new Map();
  const inventory = await Inventory.find({
    productId: { $in: products.map((product) => product._id) },
  }).select("productId availableStock").lean();
  return new Map(inventory.map((row) => [String(row.productId), row]));
};

const productTokens = (product) => [
  ...tokens(product.name),
  ...(product.tags || []).flatMap(tokens),
];

const rankProduct = (product, profile, seasonTokens, context = {}) => {
  const id = String(product._id);
  const orderCount = profile.purchaseOrders.get(id) || 0;
  const units = profile.purchaseUnits.get(id) || 0;
  const wished = profile.wishlistIds.has(id);
  const seasonal = seasonTokens.some((token) => productTokens(product).includes(token));
  const discountPercent = Number(product.mrp) > 0
    ? clamp(((Number(product.mrp) - Number(product.sellingPrice)) / Number(product.mrp)) * 100, 0, 100)
    : 0;

  let score = 0;
  score += Math.min(40, orderCount * 9);
  score += Math.min(10, units);
  score += wished ? 18 : 0;
  score += seasonal ? 12 : 0;
  score += clamp(Number(product.averageRating || 0) * 4, 0, 20);
  score += clamp(discountPercent * 0.25, 0, 8);
  score += context.category && String(product.categoryId) === String(context.category) ? 10 : 0;

  return score;
};

const diversitySelect = (rows, limit) => {
  const selected = [];
  const counts = new Map();

  for (const row of rows.sort((a, b) => b.score - a.score)) {
    const categoryId = String(row.product.categoryId || "uncategorized");
    const count = counts.get(categoryId) || 0;
    if (count >= 3 && selected.length < Math.floor(limit * 0.75)) continue;
    selected.push(row);
    counts.set(categoryId, count + 1);
    if (selected.length >= limit) break;
  }

  if (selected.length < limit) {
    for (const row of rows) {
      if (!selected.includes(row)) selected.push(row);
      if (selected.length >= limit) break;
    }
  }

  return selected;
};

const formatProduct = (product, inventory, reason, recommendationType, score) => ({
  id: String(product._id),
  name: String(product.name || ""),
  slug: String(product.slug || ""),
  image: product.images?.[0] || null,
  price: Number(product.sellingPrice || 0),
  mrp: Number(product.mrp || 0),
  unit: String(product.unit || "unit"),
  availableStock: Math.max(0, Number(inventory?.availableStock || 0)),
  rating: Number(product.averageRating || 0),
  reason,
  recommendationType,
  score: Math.round(score),
});

const loadCandidateProducts = async (ids = []) => {
  const filter = ids.length ? { isActive: true, isDeleted: false, _id: { $in: ids } } : { isActive: true, isDeleted: false };
  return Product.find(filter)
    .select("name slug images sellingPrice mrp unit categoryId tags averageRating")
    .limit(ids.length ? 250 : 300)
    .lean();
};

export const getPersonalizedRecommendations = async (userId, { limit = 10, category = null } = {}) => {
  const safeLimit = Math.min(20, Math.max(1, Number(limit) || 10));
  const profile = await loadProfile(userId);
  const seasonTokens = seasonTokensByMonth[new Date().getMonth() + 1] || [];
  const products = await Product.find({
    isActive: true,
    isDeleted: false,
    ...(category ? { categoryId: category } : {}),
  }).select("name slug images sellingPrice mrp unit categoryId tags averageRating").limit(500).lean();
  const inventoryMap = await fetchInventoryMap(products);

  const rows = products
    .map((product) => {
      const id = String(product._id);
      const purchased = profile.purchaseOrders.has(id);
      const wished = profile.wishlistIds.has(id);
      const seasonal = seasonTokens.some((token) => productTokens(product).includes(token));
      const reason = purchased
        ? "Based on your previous purchases"
        : wished
          ? "From your wishlist"
          : seasonal
            ? "Seasonal pick"
            : "Popular Fresh15 pick";
      return {
        product,
        inventory: inventoryMap.get(id),
        score: rankProduct(product, profile, seasonTokens, { category }),
        reason,
      };
    })
    .filter((row) => Number(row.inventory?.availableStock || 0) > 0);

  return {
    requestId: makeRequestId(),
    items: diversitySelect(rows, safeLimit).map((row) => formatProduct(
      row.product,
      row.inventory,
      row.reason,
      "PERSONALIZED",
      row.score,
    )),
  };
};

export const getSmartBasket = async (userId, { limit = 12 } = {}) => {
  const safeLimit = Math.min(20, Math.max(1, Number(limit) || 12));
  const profile = await loadProfile(userId);
  const seasonTokens = seasonTokensByMonth[new Date().getMonth() + 1] || [];
  const preferredIds = [...profile.purchaseOrders.keys(), ...profile.wishlistIds].slice(0, 200);
  let products = await loadCandidateProducts(preferredIds);

  if (products.length < safeLimit) {
    const fallback = await loadCandidateProducts();
    const seen = new Set(products.map((product) => String(product._id)));
    for (const product of fallback) {
      if (!seen.has(String(product._id))) products.push(product);
      if (products.length >= 300) break;
    }
  }

  const inventoryMap = await fetchInventoryMap(products);
  const rows = products
    .map((product) => {
      const id = String(product._id);
      const orders = profile.purchaseOrders.get(id) || 0;
      const units = profile.purchaseUnits.get(id) || 0;
      const lastDate = profile.lastPurchasedAt.get(id);
      const daysSince = lastDate
        ? Math.max(0, Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000))
        : null;
      const expectedCadence = orders >= 4 ? Math.max(5, Math.round(42 / orders)) : 14;
      const due = daysSince != null && daysSince >= expectedCadence;
      const seasonal = seasonTokens.some((token) => productTokens(product).includes(token));

      const score =
        orders * 10 +
        Math.min(10, units) +
        (profile.wishlistIds.has(id) ? 15 : 0) +
        (due ? 35 : 0) +
        (seasonal ? 12 : 0) +
        clamp(Number(product.averageRating || 0) * 3, 0, 15);

      return {
        product,
        inventory: inventoryMap.get(id),
        score,
        reason: due
          ? "Likely time to restock"
          : seasonal
            ? "Seasonal for you"
            : orders
              ? "You buy this regularly"
              : "Popular Fresh15 pick",
      };
    })
    .filter((row) => Number(row.inventory?.availableStock || 0) > 0);

  return {
    requestId: makeRequestId(),
    items: diversitySelect(rows, safeLimit).map((row) => formatProduct(
      row.product,
      row.inventory,
      row.reason,
      "SMART_BASKET",
      row.score,
    )),
  };
};

export const getOptimizedOffers = async (userId, { placement = "HOME", limit = 6 } = {}) => {
  const safeLimit = Math.min(12, Math.max(1, Number(limit) || 6));
  const profile = await loadProfile(userId);
  const now = new Date();
  const offers = await Offer.find({
    placement,
    isActive: true,
    isDeleted: false,
    $and: [
      { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
      { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
    ],
  }).sort({ priority: -1, createdAt: -1 }).lean();

  const purchasedIds = [...profile.purchaseOrders.keys()];
  const purchasedProducts = purchasedIds.length
    ? await Product.find({ _id: { $in: purchasedIds } }).select("name tags categoryId").lean()
    : [];

  const purchasedTokens = new Set();
  const purchasedCategories = new Set();
  for (const product of purchasedProducts) {
    productTokens(product).forEach((token) => purchasedTokens.add(token));
    if (product.categoryId) purchasedCategories.add(String(product.categoryId));
  }

  return {
    requestId: makeRequestId(),
    items: offers
      .map((offer) => {
        const targetTokens = tokens(`${offer.category || ""} ${offer.targetValue || ""} ${offer.title || ""}`);
        const tokenRelevance = targetTokens.reduce((sum, token) => sum + (purchasedTokens.has(token) ? 12 : 0), 0);
        const categoryRelevance = offer.category && purchasedCategories.has(String(offer.category)) ? 18 : 0;
        const priority = clamp(Number(offer.priority || 0), -100, 100) * 0.5;
        const urgency = offer.endsAt
          ? clamp(20 - ((new Date(offer.endsAt).getTime() - now.getTime()) / 86400000) * 2, 0, 20)
          : 0;
        return { offer, score: tokenRelevance + categoryRelevance + priority + urgency };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, safeLimit)
      .map(({ offer, score }) => ({
        ...offer,
        id: String(offer._id),
        personalizationScore: Math.round(score),
      })),
  };
};

export const getRecommendationDashboard = async (userId) => {
  const [recommendations, smartBasket, offers] = await Promise.all([
    getPersonalizedRecommendations(userId, { limit: 8 }),
    getSmartBasket(userId, { limit: 8 }),
    getOptimizedOffers(userId, { limit: 6 }),
  ]);
  return {
    recommendations,
    smartBasket,
    offers,
    generatedAt: new Date().toISOString(),
    mode: "DETERMINISTIC_FIRST_PARTY",
  };
};
