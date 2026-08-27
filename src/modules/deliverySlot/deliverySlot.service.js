import DeliverySlot from "./deliverySlot.model.js";
import DeliverySlotDay from "./deliverySlotDay.model.js";
import DeliveryZone from "./deliveryZone.model.js";
import DeliveryStore from "./deliveryStore.model.js";
import User from "../user/user.model.js";
import Delivery from "../delivery/delivery.model.js";
import Order from "../order/order.model.js";
import Address from "../address/address.model.js";
import AppError from "../../utils/AppError.js";
import Setting from "../setting/setting.model.js";

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
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};

const resolveZone = async ({ pincode, latitude, longitude }) => {
  const pin = String(pincode || "").trim();
  const lat = Number.isFinite(Number(latitude)) ? Number(latitude) : NaN;
  const lng = Number.isFinite(Number(longitude)) ? Number(longitude) : NaN;

  if (pin) {
    const zone = await DeliveryZone.findOne({ active: true, pincodes: pin });
    if (zone) {
      const hasCoords = Number.isFinite(Number(zone.latitude)) && Number.isFinite(Number(zone.longitude));
      const inside = !hasCoords || !Number.isFinite(lat) || !Number.isFinite(lng)
        || haversineKm(lat, lng, Number(zone.latitude), Number(zone.longitude)) <= Number(zone.serviceRadiusKm ?? 5);
      if (inside) return { zone, matchedBy: "PINCODE" };
    }
  }

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    const zones = await DeliveryZone.find({ active: true, latitude: { $ne: null }, longitude: { $ne: null } }).lean();
    const match = zones
      .map((zone) => ({ zone, distanceKm: haversineKm(lat, lng, Number(zone.latitude), Number(zone.longitude)) }))
      .filter((x) => x.distanceKm <= Number(x.zone.serviceRadiusKm ?? 5))
      .sort((a, b) => a.distanceKm - b.distanceKm)[0];

    if (match) return { ...match, matchedBy: "COORDINATES" };
  }

  if (pin || Number.isFinite(lat) || Number.isFinite(lng)) {
    throw new AppError(422, "DELIVERY_ZONE_UNAVAILABLE", "We do not currently deliver to this location");
  }
  throw new AppError(400, "LOCATION_REQUIRED", "Provide a pincode or latitude and longitude");
};

const resolveStore = async ({ latitude, longitude, zone }) => {
  const filter = { active: true };
  if (zone?.eligibleStoreIds?.length) filter._id = { $in: zone.eligibleStoreIds };

  const stores = await DeliveryStore.find(filter).sort({ createdAt: 1 });
  if (!stores.length) throw new AppError(503, "FULFILLMENT_UNAVAILABLE", "No active store can serve this delivery area");

  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { store: stores[0], distanceKm: null, matchedBy: "DEFAULT" };

  const eligible = stores
    .map((store) => ({ store, distanceKm: haversineKm(lat, lng, Number(store.latitude), Number(store.longitude)) }))
    .filter((x) => Number.isFinite(x.distanceKm) && x.distanceKm <= Number(x.store.serviceRadiusKm ?? 10))
    .sort((a, b) => a.distanceKm - b.distanceKm);

  if (!eligible.length) throw new AppError(422, "STORE_OUTSIDE_SERVICE_AREA", "No Fresh15 store can serve this delivery location");
  return { ...eligible[0], matchedBy: "NEAREST_ELIGIBLE" };
};

const getWorkload = async (zoneId, storeId) => {
  const [zoneOrders, storeOrders, activeDeliveries, onlinePartners] = await Promise.all([
    Order.countDocuments({ zoneId, orderStatus: { $in: ACTIVE_ORDER_STATUSES }, isDeleted: false }),
    Order.countDocuments({ storeId, orderStatus: { $in: ACTIVE_ORDER_STATUSES }, isDeleted: false }),
    Delivery.aggregate([
      { $match: { status: { $in: ACTIVE_DELIVERY_STATUSES }, riderId: { $ne: null } } },
      { $lookup: { from: "orders", localField: "orderId", foreignField: "_id", as: "order" } },
      { $unwind: "$order" },
      { $match: { "order.zoneId": zoneId, "order.storeId": storeId, "order.isDeleted": false } },
      { $count: "count" },
    ]),
    User.countDocuments({ role: "PARTNER", portal: "partner", isActive: true, isOnline: true }),
  ]);

  const activeCount = Number(activeDeliveries[0]?.count || 0);
  const partnerCapacity = onlinePartners * MAX_ACTIVE_PER_PARTNER;
  return {
    zoneOrders,
    storeOrders,
    activeDeliveries: activeCount,
    onlinePartners,
    partnerCapacity,
    partnerRemaining: Math.max(0, partnerCapacity - activeCount),
  };
};

const slotForDate = (slot, date, now, workload, zone, store, booked) => {
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
  const delay = Math.min(
    30,
    Math.ceil(pressure / Math.max(1, Number(slot.capacity))) * Number(zone.workloadDelayMinutes || 0),
  );
  const promisedAt = asap
    ? addMinutes(now, Number(slot.leadTimeMinutes || 0) + Number(store.prepMinutes || 0) + Number(zone.travelMinutes || 0) + delay)
    : addMinutes(end, Number(zone.travelMinutes || 0) + delay);

  return {
    slotId: slot._id,
    dateKey: dateKey(date),
    label: slot.label,
    type: slot.type,
    window: asap ? `Within ${Math.max(1, Math.ceil((promisedAt - now) / 60000))} min` : `${pad(Math.floor(slot.fromMinutes / 60))}:${pad(slot.fromMinutes % 60)} - ${pad(Math.floor(slot.toMinutes / 60))}:${pad(slot.toMinutes % 60)}`,
    startsAt: start.toISOString(),
    endsAt: asap ? promisedAt.toISOString() : end.toISOString(),
    promisedAt: promisedAt.toISOString(),
    etaMinutes: Math.max(1, Math.ceil((promisedAt - now) / 60000)),
    remainingCapacity: remaining,
    capacity: Number(slot.capacity),
    booked,
    zone: { id: zone._id, name: zone.name },
    store: { id: store._id, name: store.name, code: store.code },
    workload,
    cutoffAt: asap ? now.toISOString() : addMinutes(start, -Number(slot.cutoffMinutesBeforeStart || 0)).toISOString(),
  };
};

const getAvailableSlotsForLocation = async ({ pincode, latitude, longitude, subtotal = 0, addressId = null }) => {
  const resolvedZone = await resolveZone({ pincode, latitude, longitude });
  const resolvedStore = await resolveStore({ latitude, longitude, zone: resolvedZone.zone });
  const workload = await getWorkload(resolvedZone.zone._id, resolvedStore.store._id);
  const slots = await DeliverySlot.find({ active: true }).sort({ sortOrder: 1, fromMinutes: 1 }).lean();
  const now = new Date();
  const dates = [new Date(now), addMinutes(new Date(now), 24 * 60)];
  const days = slots.length
    ? await DeliverySlotDay.find({ slotId: { $in: slots.map((slot) => slot._id) }, dateKey: { $in: dates.map(dateKey) } }).lean()
    : [];
  const booked = new Map(days.map((row) => [`${row.slotId}:${row.dateKey}`, Number(row.booked || 0)]));
  const candidates = [];

  for (const date of dates) {
    for (const slot of slots) {
      if (slot.type === "ASAP" && dateKey(date) !== dateKey(now)) continue;
      const item = slotForDate(slot, date, now, workload, resolvedZone.zone, resolvedStore.store, booked.get(`${slot._id}:${dateKey(date)}`) || 0);
      if (item) candidates.push(item);
    }
  }

  const available = candidates.slice(0, 12);
  const setting = await Setting.findOne().lean();
  const baseDeliveryFee = Math.max(0, Number(resolvedZone.zone.fee || 0));
  const minOrder = Math.max(0, Number(resolvedZone.zone.minOrder || 0));
  const freeDeliveryAbove = Math.max(0, Number(setting?.freeDeliveryAbove ?? 500));
  const safeSubtotal = Math.max(0, Number(subtotal) || 0);

  return {
    addressId,
    serviceable: true,
    matchedBy: resolvedZone.matchedBy,
    pincode: String(pincode || "").trim() || null,
    location: Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude))
      ? { latitude: Number(latitude), longitude: Number(longitude) }
      : null,
    zone: { id: resolvedZone.zone._id, name: resolvedZone.zone.name, city: resolvedZone.zone.city, fee: baseDeliveryFee, minOrder, serviceRadiusKm: Number(resolvedZone.zone.serviceRadiusKm ?? 5) },
    store: { id: resolvedStore.store._id, name: resolvedStore.store.name, code: resolvedStore.store.code, distanceKm: resolvedStore.distanceKm == null ? null : Number(resolvedStore.distanceKm.toFixed(2)) },
    etaMinutes: available[0]?.etaMinutes ?? null,
    deliveryFee: safeSubtotal > 0 && safeSubtotal >= freeDeliveryAbove ? 0 : baseDeliveryFee,
    baseDeliveryFee,
    freeDeliveryAbove,
    minOrder,
    slots: available,
    generatedAt: now.toISOString(),
  };
};

export const getServiceabilityService = async (params) => getAvailableSlotsForLocation(params);

export const getAvailableDeliverySlotsService = async (userId, addressId) => {
  const address = await Address.findOne({ _id: addressId, userId });
  if (!address) throw new AppError(404, "ADDRESS_NOT_FOUND", "Address not found");
  return getAvailableSlotsForLocation({
    addressId,
    pincode: address.pincode,
    latitude: address.latitude,
    longitude: address.longitude,
  });
};

export const reserveDeliverySlotService = async ({ userId, addressId, slotId, dateKey: requestedDateKey }) => {
  if (!slotId || !requestedDateKey) throw new AppError(400, "DELIVERY_SLOT_REQUIRED", "A delivery slot is required");

  const address = await Address.findOne({ _id: addressId, userId });
  if (!address) throw new AppError(404, "ADDRESS_NOT_FOUND", "Address not found");

  const resolvedZone = await resolveZone({ pincode: address.pincode, latitude: address.latitude, longitude: address.longitude });
  const resolvedStore = await resolveStore({ latitude: address.latitude, longitude: address.longitude, zone: resolvedZone.zone });
  const slot = await DeliverySlot.findOne({ _id: slotId, active: true });
  if (!slot) throw new AppError(404, "DELIVERY_SLOT_NOT_FOUND", "Delivery slot is no longer available");

  const workload = await getWorkload(resolvedZone.zone._id, resolvedStore.store._id);
  const now = new Date();
  const requestedDate = new Date(`${requestedDateKey}T00:00:00`);
  if (Number.isNaN(requestedDate.getTime())) throw new AppError(400, "INVALID_DELIVERY_DATE", "Invalid delivery date");

  const day = await DeliverySlotDay.findOne({ slotId: slot._id, dateKey: requestedDateKey }).lean();
  const preview = slotForDate(slot.toObject(), requestedDate, now, workload, resolvedZone.zone, resolvedStore.store, Number(day?.booked || 0));
  if (!preview) throw new AppError(409, "DELIVERY_SLOT_UNAVAILABLE", "This delivery slot is no longer available");

  const updated = await DeliverySlotDay.findOneAndUpdate(
    { slotId: slot._id, dateKey: requestedDateKey, $expr: { $lt: ["$booked", Number(slot.capacity)] } },
    { $inc: { booked: 1 } },
    { new: true },
  );

  if (!updated) {
    try {
      await DeliverySlotDay.create({ slotId: slot._id, dateKey: requestedDateKey, booked: 1 });
    } catch (error) {
      if (error?.code === 11000) throw new AppError(409, "DELIVERY_SLOT_FULL", "This delivery slot just became unavailable");
      throw error;
    }
  }

  const setting = await Setting.findOne().lean();
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

export const releaseReservedDeliverySlotService = async (slotId, requestedDateKey) => {
  await DeliverySlotDay.findOneAndUpdate({ slotId, dateKey: requestedDateKey, booked: { $gt: 0 } }, { $inc: { booked: -1 } });
};

export const createDeliverySlotService = async (userId, body) => {
  if (Number(body.fromMinutes) >= Number(body.toMinutes)) throw new AppError(400, "INVALID_SLOT_WINDOW", "Slot end must be after slot start");
  return DeliverySlot.create({ ...body, createdBy: userId, updatedBy: userId });
};

export const updateDeliverySlotService = async (id, userId, body) => {
  const slot = await DeliverySlot.findById(id);
  if (!slot) throw new AppError(404, "DELIVERY_SLOT_NOT_FOUND", "Delivery slot not found");
  Object.assign(slot, body, { updatedBy: userId });
  if (slot.fromMinutes >= slot.toMinutes) throw new AppError(400, "INVALID_SLOT_WINDOW", "Slot end must be after slot start");
  await slot.save();
  return slot;
};

export const deleteDeliverySlotService = async (id) => {
  const slot = await DeliverySlot.findById(id);
  if (!slot) throw new AppError(404, "DELIVERY_SLOT_NOT_FOUND", "Delivery slot not found");
  await slot.deleteOne();
  await DeliverySlotDay.deleteMany({ slotId: id });
};

export const getAllDeliverySlotsService = async () => DeliverySlot.find().sort({ sortOrder: 1, fromMinutes: 1 });

export const createDeliveryZoneService = async (userId, body) =>
  DeliveryZone.create({
    ...body,
    createdBy: userId,
    updatedBy: userId,
    pincodes: (body.pincodes || []).map((value) => String(value).trim()).filter(Boolean),
    eligibleStoreIds: (body.eligibleStoreIds || []).filter(Boolean),
  });

export const getAllDeliveryZonesService = async () => DeliveryZone.find().populate("eligibleStoreIds", "name code active").sort({ name: 1 });

export const updateDeliveryZoneService = async (id, userId, body) => {
  const zone = await DeliveryZone.findById(id);
  if (!zone) throw new AppError(404, "DELIVERY_ZONE_NOT_FOUND", "Delivery zone not found");

  Object.assign(zone, body, { updatedBy: userId });
  if (body.pincodes) zone.pincodes = body.pincodes.map((value) => String(value).trim()).filter(Boolean);
  if (body.eligibleStoreIds) zone.eligibleStoreIds = body.eligibleStoreIds.filter(Boolean);
  await zone.save();
  return zone;
};

export const deleteDeliveryZoneService = async (id) => {
  const zone = await DeliveryZone.findById(id);
  if (!zone) throw new AppError(404, "DELIVERY_ZONE_NOT_FOUND", "Delivery zone not found");
  await zone.deleteOne();
};

export const createDeliveryStoreService = async (userId, body) =>
  DeliveryStore.create({ ...body, createdBy: userId, updatedBy: userId, code: String(body.code).trim().toUpperCase() });

export const getAllDeliveryStoresService = async () => DeliveryStore.find().sort({ createdAt: 1 });

export const updateDeliveryStoreService = async (id, userId, body) => {
  const store = await DeliveryStore.findById(id);
  if (!store) throw new AppError(404, "DELIVERY_STORE_NOT_FOUND", "Store not found");
  Object.assign(store, body, { updatedBy: userId });
  if (body.code) store.code = String(body.code).trim().toUpperCase();
  await store.save();
  return store;
};

export const deleteDeliveryStoreService = async (id) => {
  const store = await DeliveryStore.findById(id);
  if (!store) throw new AppError(404, "DELIVERY_STORE_NOT_FOUND", "Store not found");
  await store.deleteOne();
};
