import RecommendationEvent from "./recommendation-event.model.js";
import Product from "../product/product.model.js";
import Offer from "../offer/offer.model.js";
import AppError from "../../utils/AppError.js";

const cleanId = (value) => {
  const text = String(value || "").trim();
  return /^[a-f\d]{24}$/i.test(text) ? text : null;
};

const cleanText = (value, max = 100) => String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);

export const recordRecommendationEvents = async (userId, input) => {
  if (!Array.isArray(input?.events) || !input.events.length) {
    throw new AppError(422, "RECOMMENDATION_EVENTS_REQUIRED", "At least one event is required");
  }
  if (input.events.length > 30) {
    throw new AppError(413, "RECOMMENDATION_EVENTS_LIMIT", "A maximum of 30 events can be submitted at once");
  }

  const events = input.events.flatMap((raw) => {
    const eventType = cleanText(raw?.eventType, 32).toUpperCase();
    const recommendationType = cleanText(raw?.recommendationType || "PERSONALIZED", 32).toUpperCase();
    const surface = cleanText(raw?.surface || "HOME", 32).toUpperCase();
    const productId = cleanId(raw?.productId);
    const offerId = cleanId(raw?.offerId);

    if (![
      "IMPRESSION",
      "CLICK",
      "ADD_TO_CART",
      "PURCHASE",
      "DISMISS",
      "OFFER_IMPRESSION",
      "OFFER_CLICK",
    ].includes(eventType)) return [];
    if (![
      "PERSONALIZED",
      "SMART_BASKET",
      "OFFER",
      "SEASONAL",
      "POPULAR",
    ].includes(recommendationType)) return [];
    if (![
      "HOME",
      "SEARCH",
      "CATEGORY",
      "PRODUCT",
      "CART",
      "CHECKOUT",
      "OFFERS",
      "OTHER",
    ].includes(surface)) return [];
    if (eventType.startsWith("OFFER_") && !offerId) return [];
    if (!eventType.startsWith("OFFER_") && !productId) return [];

    return [{
      userId,
      eventType,
      recommendationType,
      surface,
      productId,
      offerId,
      recommendationRequestId: cleanText(raw?.recommendationRequestId, 100) || null,
      position: Number.isInteger(Number(raw?.position)) ? clamp(Number(raw.position), 0, 200) : null,
      sessionId: cleanText(raw?.sessionId, 100) || null,
    }];
  });

  if (!events.length) throw new AppError(422, "RECOMMENDATION_EVENTS_INVALID", "No valid events were supplied");
  await RecommendationEvent.insertMany(events, { ordered: false });
  return { accepted: events.length };
};

const clamp = (n, min, max) => Math.max(min, Math.min(max, Number(n) || 0));

export const recordCommerceEventFromOrder = async (userId, productIds = []) => {
  const uniqueIds = [...new Set(productIds.map(cleanId).filter(Boolean))];
  if (!uniqueIds.length) return;
  const events = uniqueIds.map((productId) => ({
    userId,
    eventType: "PURCHASE",
    recommendationType: "PERSONALIZED",
    surface: "CHECKOUT",
    productId,
  }));
  await RecommendationEvent.insertMany(events, { ordered: false });
};

export const getRecommendationAnalytics = async ({ days = 30 } = {}) => {
  const safeDays = Math.min(180, Math.max(1, Number(days) || 30));
  const from = new Date(Date.now() - safeDays * 86400000);

  const [totals, offers, products] = await Promise.all([
    RecommendationEvent.aggregate([
      { $match: { createdAt: { $gte: from } } },
      { $group: { _id: "$eventType", count: { $sum: 1 } } },
    ]),
    RecommendationEvent.aggregate([
      { $match: { createdAt: { $gte: from }, offerId: { $ne: null } } },
      { $group: { _id: { offerId: "$offerId", eventType: "$eventType" }, count: { $sum: 1 } } },
      { $group: { _id: "$_id.offerId", events: { $push: { type: "$_id.eventType", count: "$count" } }, total: { $sum: "$count" } } },
      { $sort: { total: -1 } },
      { $limit: 20 },
    ]),
    RecommendationEvent.aggregate([
      { $match: { createdAt: { $gte: from }, productId: { $ne: null }, eventType: { $in: ["IMPRESSION", "CLICK", "ADD_TO_CART", "PURCHASE"] } } },
      { $group: { _id: { productId: "$productId", eventType: "$eventType" }, count: { $sum: 1 } } },
      { $group: { _id: "$_id.productId", events: { $push: { type: "$_id.eventType", count: "$count" } }, total: { $sum: "$count" } } },
      { $sort: { total: -1 } },
      { $limit: 20 },
    ]),
  ]);

  const counts = Object.fromEntries(totals.map((row) => [row._id, row.count]));
  const offerIds = offers.map((row) => row._id);
  const productIds = products.map((row) => row._id);
  const [offerDocs, productDocs] = await Promise.all([
    Offer.find({ _id: { $in: offerIds } }).select("title discount couponCode").lean(),
    Product.find({ _id: { $in: productIds } }).select("name sku").lean(),
  ]);

  const offerMap = new Map(offerDocs.map((item) => [String(item._id), item]));
  const productMap = new Map(productDocs.map((item) => [String(item._id), item]));

  const normalizeRows = (rows, lookup, kind) => rows.map((row) => {
    const item = lookup.get(String(row._id)) || {};
    const eventCounts = Object.fromEntries((row.events || []).map((event) => [event.type, event.count]));
    const impressions = Number(eventCounts.IMPRESSION || eventCounts.OFFER_IMPRESSION || 0);
    const clicks = Number(eventCounts.CLICK || eventCounts.OFFER_CLICK || 0);
    return {
      id: String(row._id),
      name: item.title || item.name || "Unknown",
      code: item.sku || item.couponCode || null,
      kind,
      impressions,
      clicks,
      addToCart: Number(eventCounts.ADD_TO_CART || 0),
      purchases: Number(eventCounts.PURCHASE || 0),
      ctr: impressions ? Number((clicks / impressions * 100).toFixed(2)) : 0,
      totalEvents: row.total,
    };
  });

  return {
    days: safeDays,
    totals: {
      impressions: Number(counts.IMPRESSION || 0) + Number(counts.OFFER_IMPRESSION || 0),
      clicks: Number(counts.CLICK || 0) + Number(counts.OFFER_CLICK || 0),
      addToCart: Number(counts.ADD_TO_CART || 0),
      purchases: Number(counts.PURCHASE || 0),
      dismissals: Number(counts.DISMISS || 0),
    },
    offers: normalizeRows(offers, offerMap, "OFFER"),
    products: normalizeRows(products, productMap, "PRODUCT"),
  };
};
