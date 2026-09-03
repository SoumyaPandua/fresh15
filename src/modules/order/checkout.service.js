import crypto from "crypto";
import mongoose from "mongoose";
import Cart from "../cart/cart.model.js";
import Inventory from "../inventory/inventory.model.js";
import Address from "../address/address.model.js";
import Product from "../product/product.model.js";
import Order from "./order.model.js";
import Coupon from "../coupon/coupon.model.js";
import DeliverySlot from "../deliverySlot/deliverySlot.model.js";
import DeliverySlotDay from "../deliverySlot/deliverySlotDay.model.js";
import DeliveryZone from "../deliverySlot/deliveryZone.model.js";
import DeliveryStore from "../deliverySlot/deliveryStore.model.js";
import User from "../user/user.model.js";
import Delivery from "../delivery/delivery.model.js";
import Setting from "../setting/setting.model.js";
import { LoyaltyWallet, LoyaltyLedger } from "../loyalty/loyalty.model.js";
import { sendNotificationService } from "../notification/notification.service.js";
import { emitNewOrder } from "../../socket/emitters.js";
import { writeAuditLog } from "../audit/audit.service.js";
import AppError from "../../utils/AppError.js";
import { withTransaction } from "../../utils/transaction.js";
import { processBackInStockAlertService } from "../productAlert/productAlert.service.js";

const ONLINE_PAYMENT_WINDOW_MS = 5 * 60 * 1000;
const ACTIVE_ORDER_STATUSES = ["PENDING", "CONFIRMED", "PACKING", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY"];
const ACTIVE_DELIVERY_STATUSES = ["PENDING", "ASSIGNED", "ACCEPTED", "PICKED_UP", "OUT_FOR_DELIVERY"];
const MAX_ACTIVE_PER_PARTNER = Math.max(1, Number(process.env.DELIVERY_MAX_ACTIVE_PER_PARTNER || 2));

const pad = (n) => String(n).padStart(2, "0");
const dateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const addMinutes = (date, minutes) => new Date(date.getTime() + minutes * 60000);
const haversineKm = (aLat, aLng, bLat, bLng) => {
  if (![aLat, aLng, bLat, bLng].every(Number.isFinite)) return Infinity;
  const r = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};

const canonicalCheckout = (body) => JSON.stringify({
  addressId: String(body.addressId || ""),
  deliverySlotId: String(body.deliverySlotId || ""),
  deliveryDateKey: String(body.deliveryDateKey || ""),
  paymentMethod: String(body.paymentMethod || ""),
  couponCode: String(body.couponCode || "").trim().toUpperCase(),
  loyaltyPoints: Math.max(0, Math.floor(Number(body.loyaltyPoints || 0))),
  notes: String(body.notes || "").slice(0, 500),
});

const hashCheckout = (body) => crypto.createHash("sha256").update(canonicalCheckout(body)).digest("hex");

const resolveZone = async ({ pincode, latitude, longitude }, session) => {
  const pin = String(pincode || "").trim();
  const lat = Number.isFinite(Number(latitude)) ? Number(latitude) : NaN;
  const lng = Number.isFinite(Number(longitude)) ? Number(longitude) : NaN;
  let query;

  if (pin) {
    query = DeliveryZone.findOne({ active: true, pincodes: pin });
    if (session) query.session(session);
    const zone = await query;
    if (zone) {
      const hasCoords = Number.isFinite(Number(zone.latitude)) && Number.isFinite(Number(zone.longitude));
      const inside = !hasCoords || !Number.isFinite(lat) || !Number.isFinite(lng) || haversineKm(lat, lng, Number(zone.latitude), Number(zone.longitude)) <= Number(zone.serviceRadiusKm ?? 5);
      if (inside) return { zone, matchedBy: "PINCODE" };
    }
  }

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    query = DeliveryZone.find({ active: true, latitude: { $ne: null }, longitude: { $ne: null } }).lean();
    if (session) query.session(session);
    const zones = await query;
    const match = zones.map((zone) => ({ zone, distanceKm: haversineKm(lat, lng, Number(zone.latitude), Number(zone.longitude)) }))
      .filter((x) => x.distanceKm <= Number(x.zone.serviceRadiusKm ?? 5))
      .sort((a, b) => a.distanceKm - b.distanceKm)[0];
    if (match) return { ...match, matchedBy: "COORDINATES" };
  }

  throw new AppError(pin || Number.isFinite(lat) || Number.isFinite(lng) ? 422 : 400, pin || Number.isFinite(lat) || Number.isFinite(lng) ? "DELIVERY_ZONE_UNAVAILABLE" : "LOCATION_REQUIRED", pin || Number.isFinite(lat) || Number.isFinite(lng) ? "We do not currently deliver to this location" : "Provide a pincode or latitude and longitude");
};

const resolveStore = async ({ latitude, longitude, zone }, session) => {
  const filter = { active: true };
  if (zone?.eligibleStoreIds?.length) filter._id = { $in: zone.eligibleStoreIds };
  let query = DeliveryStore.find(filter).sort({ createdAt: 1 });
  if (session) query = query.session(session);
  const stores = await query;
  if (!stores.length) throw new AppError(503, "FULFILLMENT_UNAVAILABLE", "No active store can serve this delivery area");
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { store: stores[0], distanceKm: null, matchedBy: "DEFAULT" };
  const eligible = stores.map((store) => ({ store, distanceKm: haversineKm(lat, lng, Number(store.latitude), Number(store.longitude)) }))
    .filter((x) => Number.isFinite(x.distanceKm) && x.distanceKm <= Number(x.store.serviceRadiusKm ?? 10))
    .sort((a, b) => a.distanceKm - b.distanceKm);
  if (!eligible.length) throw new AppError(422, "STORE_OUTSIDE_SERVICE_AREA", "No Fresh15 store can serve this delivery location");
  return { ...eligible[0], matchedBy: "NEAREST_ELIGIBLE" };
};

const getWorkload = async (zoneId, storeId, session) => {
  let q1 = Order.countDocuments({ zoneId, orderStatus: { $in: ACTIVE_ORDER_STATUSES }, isDeleted: false });
  let q2 = Order.countDocuments({ storeId, orderStatus: { $in: ACTIVE_ORDER_STATUSES }, isDeleted: false });
  let q3 = Delivery.aggregate([
    { $match: { status: { $in: ACTIVE_DELIVERY_STATUSES }, riderId: { $ne: null } } },
    { $lookup: { from: "orders", localField: "orderId", foreignField: "_id", as: "order" } },
    { $unwind: "$order" },
    { $match: { "order.zoneId": zoneId, "order.storeId": storeId, "order.isDeleted": false } },
    { $count: "count" },
  ]);
  let q4 = User.countDocuments({ role: "PARTNER", portal: "partner", isActive: true, isOnline: true });
  if (session) {
    q1 = q1.session(session);
    q2 = q2.session(session);
    q3 = q3.session(session);
    q4 = q4.session(session);
  }
  const [zoneOrders, storeOrders, activeDeliveries, onlinePartners] = await Promise.all([q1, q2, q3, q4]);
  const activeCount = Number(activeDeliveries[0]?.count || 0);
  const partnerCapacity = onlinePartners * MAX_ACTIVE_PER_PARTNER;
  return { zoneOrders, storeOrders, activeDeliveries: activeCount, onlinePartners, partnerCapacity, partnerRemaining: Math.max(0, partnerCapacity - activeCount) };
};

const slotPreview = (slot, requestedDateKey, now, workload, zone, store, booked) => {
  const date = new Date(`${requestedDateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) throw new AppError(400, "INVALID_DELIVERY_DATE", "Invalid delivery date");
  const asap = slot.type === "ASAP";
  const start = new Date(date);
  const end = new Date(date);
  if (asap) {
    start.setTime(now.getTime());
  } else {
    start.setHours(Math.floor(slot.fromMinutes / 60), slot.fromMinutes % 60, 0, 0);
    end.setHours(Math.floor(slot.toMinutes / 60), slot.toMinutes % 60, 0, 0);
    const cutoff = addMinutes(start, -Number(slot.cutoffMinutesBeforeStart || 0));
    if (dateKey(date) === dateKey(now) && now >= cutoff) return null;
    if (end <= now) return null;
  }
  const zoneRemaining = Math.max(0, Number(zone.maxConcurrentOrders) - workload.zoneOrders);
  const storeRemaining = Math.max(0, Number(store.maxConcurrentOrders) - workload.storeOrders);
  const slotRemaining = Math.max(0, Number(slot.capacity) - booked);
  const remaining = Math.min(slotRemaining, zoneRemaining, storeRemaining, workload.partnerRemaining);
  if (remaining <= 0) return null;
  const pressure = Math.max(workload.zoneOrders, workload.storeOrders);
  const delay = Math.min(30, Math.ceil(pressure / Math.max(1, Number(slot.capacity))) * Number(zone.workloadDelayMinutes || 0));
  const promisedAt = asap
    ? addMinutes(now, Number(slot.leadTimeMinutes || 0) + Number(store.prepMinutes || 0) + Number(zone.travelMinutes || 0) + delay)
    : addMinutes(end, Number(zone.travelMinutes || 0) + delay);
  return {
    slotId: slot._id,
    dateKey: requestedDateKey,
    label: slot.label,
    promisedAt: promisedAt.toISOString(),
    startsAt: start.toISOString(),
    endsAt: asap ? promisedAt.toISOString() : end.toISOString(),
    etaMinutes: Math.max(1, Math.ceil((promisedAt - now) / 60000)),
  };
};

const reserveSlot = async ({ userId, addressId, slotId, requestedDateKey }, session) => {
  const addressQuery = Address.findOne({ _id: addressId, userId });
  if (session) addressQuery.session(session);
  const address = await addressQuery;
  if (!address) throw new AppError(404, "ADDRESS_NOT_FOUND", "Address not found");

  const resolvedZone = await resolveZone({ pincode: address.pincode, latitude: address.latitude, longitude: address.longitude }, session);
  const resolvedStore = await resolveStore({ latitude: address.latitude, longitude: address.longitude, zone: resolvedZone.zone }, session);
  let slotQuery = DeliverySlot.findOne({ _id: slotId, active: true });
  if (session) slotQuery = slotQuery.session(session);
  const slot = await slotQuery;
  if (!slot) throw new AppError(404, "DELIVERY_SLOT_NOT_FOUND", "Delivery slot is no longer available");

  const workload = await getWorkload(resolvedZone.zone._id, resolvedStore.store._id, session);
  const preview = slotPreview(slot.toObject(), requestedDateKey, new Date(), workload, resolvedZone.zone, resolvedStore.store, 0);
  if (!preview) throw new AppError(409, "DELIVERY_SLOT_UNAVAILABLE", "This delivery slot is no longer available");

  const dayQuery = DeliverySlotDay.findOne({ slotId: slot._id, dateKey: requestedDateKey });
  if (session) dayQuery.session(session);
  const day = await dayQuery;
  const booked = Number(day?.booked || 0);
  if (booked >= Number(slot.capacity)) throw new AppError(409, "DELIVERY_SLOT_FULL", "This delivery slot is full");

  if (day) {
    const updated = await DeliverySlotDay.findOneAndUpdate(
      { _id: day._id, booked: { $lt: Number(slot.capacity) } },
      { $inc: { booked: 1 } },
      { new: true, session },
    );
    if (!updated) throw new AppError(409, "DELIVERY_SLOT_FULL", "This delivery slot just became unavailable");
  } else {
    try {
      await DeliverySlotDay.create([{ slotId: slot._id, dateKey: requestedDateKey, booked: 1 }], { session });
    } catch (error) {
      if (error?.code === 11000) throw new AppError(409, "DELIVERY_SLOT_FULL", "This delivery slot just became unavailable");
      throw error;
    }
  }

  let settingQuery = Setting.findOne().lean();
  if (session) settingQuery = settingQuery.session(session);
  const setting = await settingQuery;
  const freeDeliveryAbove = Math.max(0, Number(setting?.freeDeliveryAbove ?? 500));
  return {
    slotId: slot._id,
    dateKey: requestedDateKey,
    label: slot.label,
    promisedAt: preview.promisedAt,
    startsAt: preview.startsAt,
    endsAt: preview.endsAt,
    zoneId: resolvedZone.zone._id,
    storeId: resolvedStore.store._id,
    minOrder: Math.max(0, Number(resolvedZone.zone.minOrder || 0)),
    baseDeliveryFee: Math.max(0, Number(resolvedZone.zone.fee || 0)),
    freeDeliveryAbove,
    storeDistanceKm: resolvedStore.distanceKm == null ? null : Number(resolvedStore.distanceKm.toFixed(2)),
    etaMinutes: preview.etaMinutes,
  };
};

const reserveInventory = async (productId, quantity, session) => {
  const inventory = await Inventory.findOneAndUpdate(
    { productId, $expr: { $gte: [{ $subtract: ["$currentStock", "$reservedStock"] }, quantity] } },
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
    { new: true, updatePipeline: true, session },
  );
  if (!inventory) throw new AppError(409, "INSUFFICIENT_STOCK", "Insufficient stock");
  return inventory;
};

const applyCoupon = async (code, subtotal, session) => {
  const couponCode = String(code || "").trim().toUpperCase();
  if (!couponCode) return { discountAmount: 0, couponId: null, code: "" };
  const query = Coupon.findOne({ code: couponCode, isActive: true, isDeleted: false });
  if (session) query.session(session);
  const coupon = await query;
  if (!coupon) throw new AppError(404, "COUPON_NOT_FOUND", "Coupon not found or inactive");
  const now = new Date();
  if (coupon.startsAt && now < coupon.startsAt) throw new AppError(409, "COUPON_NOT_STARTED", "Coupon is not active yet");
  if (coupon.endsAt && now > coupon.endsAt) throw new AppError(409, "COUPON_EXPIRED", "Coupon has expired");
  if (Number(coupon.minOrderAmount || 0) > subtotal) throw new AppError(422, "COUPON_MIN_ORDER", `Minimum order value for this coupon is ₹${Number(coupon.minOrderAmount).toFixed(2)}`);
  if (Number.isFinite(Number(coupon.usageLimit)) && Number(coupon.usedCount || 0) >= Number(coupon.usageLimit)) throw new AppError(409, "COUPON_EXHAUSTED", "Coupon usage limit has been reached");
  let discountAmount = 0;
  if (coupon.discountType === "PERCENTAGE") discountAmount = subtotal * Number(coupon.discountValue || 0) / 100;
  else discountAmount = Number(coupon.discountValue || 0);
  discountAmount = Math.min(subtotal, Math.max(0, Number(discountAmount.toFixed(2))));
  return { discountAmount, couponId: coupon._id, code: coupon.code };
};

const markCouponUsed = async (couponId, session) => {
  if (!couponId) return;
  const coupon = await Coupon.findOneAndUpdate(
    { _id: couponId, isActive: true, isDeleted: false, $or: [{ usageLimit: null }, { usageLimit: { $exists: false } }, { $expr: { $lt: ["$usedCount", "$usageLimit"] } }] },
    { $inc: { usedCount: 1 } },
    { new: true, session },
  );
  if (!coupon) throw new AppError(409, "COUPON_EXHAUSTED", "Coupon usage limit has been reached");
};

const reserveLoyalty = async (userId, orderId, points, session) => {
  const p = Math.max(0, Math.floor(Number(points) || 0));
  if (!p) return;
  const wallet = await LoyaltyWallet.findOneAndUpdate(
    { userId, $expr: { $gte: ["$balance", p] } },
    { $inc: { balance: -p, lifetimeRedeemed: p } },
    { new: true, session },
  );
  if (!wallet) throw new AppError(409, "INSUFFICIENT_POINTS", "You do not have enough FreshPoints");
  await LoyaltyLedger.create([{
    userId,
    type: "REDEEM",
    points: -p,
    balanceAfter: Number(wallet.balance),
    orderId,
    idempotencyKey: `redeem:${orderId}`,
    description: `Redeemed ${p} FreshPoints on order`,
  }], { session });
};

const buildSubstitutionSnapshot = async (cartItem, product, session) => {
  const preference = cartItem.substitutionPreference || { type: "CALL_ME", preferredReplacementProductId: null };
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
  if (String(snapshot.preferredReplacementProductId) === String(product._id)) {
    throw new AppError(400, "INVALID_REPLACEMENT_PRODUCT", "Preferred replacement must be different from the ordered product");
  }
  const replacementQuery = Product.findOne({ _id: snapshot.preferredReplacementProductId, isDeleted: false, isActive: true }).select("name images sku categoryId");
  if (session) replacementQuery.session(session);
  const replacement = await replacementQuery;
  if (!replacement) throw new AppError(409, "REPLACEMENT_PRODUCT_UNAVAILABLE", "Preferred replacement product is no longer available");
  if (product.categoryId && replacement.categoryId && String(product.categoryId) !== String(replacement.categoryId)) throw new AppError(409, "REPLACEMENT_CATEGORY_CONFLICT", "Preferred replacement must belong to the same category");
  snapshot.preferredReplacementProductName = replacement.name;
  snapshot.preferredReplacementSku = replacement.sku;
  snapshot.preferredReplacementImage = replacement.images?.[0] || null;
  return snapshot;
};

export const createOrderTransactionalService = async (userId, body, idempotencyKey) => {
  const key = String(idempotencyKey || "").trim();
  const requestHash = hashCheckout(body);

  if (key) {
    const existing = await Order.findOne({ userId, checkoutIdempotencyKey: key });
    if (existing) {
      if (existing.checkoutRequestHash && existing.checkoutRequestHash !== requestHash) throw new AppError(409, "IDEMPOTENCY_KEY_REUSED", "This checkout request key was already used for a different request");
      return existing;
    }
  }

  const result = await withTransaction(async (session) => {
    const address = await Address.findOne({ _id: body.addressId, userId }).session(session);
    if (!address) throw new AppError(404, "ADDRESS_NOT_FOUND", "Address not found");

    const cart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      select: "name images sku sellingPrice isActive isDeleted categoryId",
    }).session(session);
    if (!cart || cart.items.length === 0) throw new AppError(409, "CART_EMPTY", "Cart is empty");

    const orderItems = [];
    let subtotal = 0;

    for (const item of cart.items) {
      const product = item.productId;
      if (!product || product.isDeleted || product.isActive === false) throw new AppError(409, "PRODUCT_UNAVAILABLE", "A product in your cart is no longer available");
      const price = Number(product.sellingPrice);
      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) throw new AppError(422, "INVALID_CART_QUANTITY", "Cart contains an invalid quantity");
      const itemSubtotal = Number((price * quantity).toFixed(2));
      await reserveInventory(product._id, quantity, session);
      orderItems.push({
        productId: product._id,
        productName: product.name,
        image: product.images?.[0] || null,
        sku: product.sku,
        price,
        quantity,
        subtotal: itemSubtotal,
        substitutionPreference: await buildSubstitutionSnapshot(item, product, session),
      });
      subtotal += itemSubtotal;
    }

    subtotal = Number(subtotal.toFixed(2));
    const coupon = await applyCoupon(body.couponCode, subtotal, session);
    const slot = await reserveSlot({ userId, addressId: body.addressId, slotId: body.deliverySlotId, requestedDateKey: body.deliveryDateKey }, session);

    if (subtotal < slot.minOrder) throw new AppError(422, "MIN_ORDER_NOT_MET", `Minimum order value for this area is ₹${Math.ceil(slot.minOrder)}`);

    const setting = await Setting.findOne().session(session);
    const configuredDeliveryCharge = Number(setting?.deliveryCharge ?? 40);
    const deliveryCharge = subtotal >= Number(slot.freeDeliveryAbove ?? setting?.freeDeliveryAbove ?? 500) ? 0 : Number(slot.baseDeliveryFee ?? configuredDeliveryCharge);
    const loyaltyPoints = Math.max(0, Math.floor(Number(body.loyaltyPoints || 0)));
    const eligibleSubtotal = Math.max(0, subtotal - coupon.discountAmount);
    const capPercent = 20;
    const pointsPerRupee = 10;
    const capPoints = Math.floor((eligibleSubtotal * capPercent / 100) * pointsPerRupee);
    const walletQuery = LoyaltyWallet.findOne({ userId }).session(session);
    const wallet = await walletQuery;
    const maxRedeemable = Math.max(0, Math.min(Number(wallet?.balance || 0), capPoints));
    if (loyaltyPoints > maxRedeemable) throw new AppError(409, "LOYALTY_REDEMPTION_EXCEEDED", "Requested FreshPoints exceed the allowed redemption for this order");
    const loyaltyDiscount = Number((loyaltyPoints / pointsPerRupee).toFixed(2));
    const grandTotal = Number(Math.max(0, subtotal + deliveryCharge - coupon.discountAmount - loyaltyDiscount).toFixed(2));

    const orderNumber = `ORD-${Date.now().toString().slice(-10)}-${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`;

    let order;
    try {
      [order] = await Order.create([{
        orderNumber,
        checkoutIdempotencyKey: key || null,
        checkoutRequestHash: key ? requestHash : null,
        userId,
        addressId: body.addressId,
        zoneId: slot.zoneId,
        storeId: slot.storeId,
        deliverySlotId: slot.slotId,
        deliveryDateKey: slot.dateKey,
        deliverySlotLabel: slot.label,
        promisedDeliveryAt: slot.promisedAt,
        items: orderItems,
        totalItems: orderItems.length,
        totalQuantity: orderItems.reduce((sum, item) => sum + item.quantity, 0),
        subtotal,
        deliveryCharge,
        discount: coupon.discountAmount,
        couponId: coupon.couponId,
        couponCode: coupon.code,
        couponDiscount: coupon.discountAmount,
        loyaltyPointsRedeemed: loyaltyPoints,
        loyaltyDiscount,
        tax: 0,
        grandTotal,
        paymentMethod: body.paymentMethod,
        paymentStatus: "PENDING",
        paymentExpiresAt: body.paymentMethod === "ONLINE" ? new Date(Date.now() + ONLINE_PAYMENT_WINDOW_MS) : null,
        orderStatus: body.paymentMethod === "COD" ? "CONFIRMED" : "PENDING",
        stockReserved: true,
        createdBy: userId,
        notes: body.notes || "",
      }], { session });
    } catch (error) {
      if (error?.code === 11000 && key) {
        const existing = await Order.findOne({ userId, checkoutIdempotencyKey: key }).session(session);
        if (existing) {
          if (existing.checkoutRequestHash && existing.checkoutRequestHash !== requestHash) throw new AppError(409, "IDEMPOTENCY_KEY_REUSED", "This checkout request key was already used for a different request");
          return existing;
        }
      }
      throw error;
    }

    if (loyaltyPoints > 0) await reserveLoyalty(userId, order._id, loyaltyPoints, session);
    if (coupon.couponId) await markCouponUsed(coupon.couponId, session);

    cart.items = [];
    cart.calculateTotals();
    await cart.save({ session });

    return order;
  });

  emitNewOrder({
    orderId: result._id,
    orderNumber: result.orderNumber,
    customerId: result.userId,
    totalItems: result.totalItems,
    totalQuantity: result.totalQuantity,
    grandTotal: result.grandTotal,
    paymentMethod: result.paymentMethod,
    orderStatus: result.orderStatus,
    createdAt: result.createdAt,
  });

  try {
    await sendNotificationService({
      userId,
      title: "Order placed successfully",
      message: `Your order ${result.orderNumber} has been placed successfully.`,
      type: "ORDER_PLACED",
      channel: "IN_APP",
      metadata: { orderId: result._id.toString(), orderNumber: result.orderNumber },
      createdBy: userId,
    });
  } catch (error) {
    console.error("Order placed notification failed:", error.message);
  }

  await writeAuditLog({
    actorId: userId,
    action: "ORDER_CREATED",
    resourceType: "Order",
    resourceId: result._id,
    details: { orderNumber: result.orderNumber, grandTotal: result.grandTotal, paymentMethod: result.paymentMethod, idempotency: Boolean(key) },
  });

  return await Order.findById(result._id).populate("addressId").populate("userId", "name email phone");
};
