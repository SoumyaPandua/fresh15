import DeliverySlot from "./deliverySlot.model.js";
import DeliverySlotDay from "./deliverySlotDay.model.js";
import DeliveryZone from "./deliveryZone.model.js";
import DeliveryStore from "./deliveryStore.model.js";
import User from "../user/user.model.js";
import Delivery from "../delivery/delivery.model.js";
import Order from "../order/order.model.js";
import Address from "../address/address.model.js";
import AppError from "../../utils/AppError.js";

const ACTIVE_ORDER_STATUSES = ["PENDING", "CONFIRMED", "PACKING", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY"];
const ACTIVE_DELIVERY_STATUSES = ["PENDING", "ASSIGNED", "ACCEPTED", "PICKED_UP", "OUT_FOR_DELIVERY"];
const MAX_ACTIVE_PER_PARTNER = Math.max(1, Number(process.env.DELIVERY_MAX_ACTIVE_PER_PARTNER || 2));

const pad = (n) => String(n).padStart(2, "0");
const minutesOfDay = (date) => date.getHours() * 60 + date.getMinutes();
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

const resolveZone = async (address) => {
  const pincode = String(address.pincode || "").trim();
  const zone = await DeliveryZone.findOne({ active: true, pincodes: pincode });
  if (!zone) throw new AppError(422, "DELIVERY_ZONE_UNAVAILABLE", "We do not currently deliver to this address");
  return zone;
};

const resolveStore = async (address) => {
  const stores = await DeliveryStore.find({ active: true }).sort({ createdAt: 1 });
  if (!stores.length) throw new AppError(503, "FULFILLMENT_UNAVAILABLE", "No active store is available for this delivery area");

  const lat =
    address.latitude !== null &&
    address.latitude !== undefined &&
    address.latitude !== ""
      ? Number(address.latitude)
      : NaN;
  const lng =
    address.longitude !== null &&
    address.longitude !== undefined &&
    address.longitude !== ""
      ? Number(address.longitude)
      : NaN;

  // Pincode/zone already establishes serviceability. Coordinates are optional
  // on customer addresses, so do not treat null as 0,0.
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return stores[0];
  }

  const withDistance = stores.map((store) => ({
    store,
    distanceKm: haversineKm(lat, lng, Number(store.latitude), Number(store.longitude)),
  }));

  const eligible = withDistance.filter(
    (x) => x.distanceKm <= Number(x.store.serviceRadiusKm || 10),
  );

  if (!eligible.length) {
    throw new AppError(422, "STORE_OUTSIDE_SERVICE_AREA", "No store can serve this delivery address");
  }

  eligible.sort((a, b) => a.distanceKm - b.distanceKm);
  return eligible[0].store;
};

const getWorkload = async (zoneId, storeId) => {
  const [zoneOrders, storeOrders, activeDeliveries, onlinePartners] = await Promise.all([
    Order.countDocuments({ zoneId, orderStatus: { $in: ACTIVE_ORDER_STATUSES }, isDeleted: false }),
    Order.countDocuments({ storeId, orderStatus: { $in: ACTIVE_ORDER_STATUSES }, isDeleted: false }),
    Delivery.countDocuments({ status: { $in: ACTIVE_DELIVERY_STATUSES }, riderId: { $ne: null } }),
    User.countDocuments({ role: "PARTNER", portal: "partner", isActive: true, isOnline: true }),
  ]);

  const partnerCapacity = onlinePartners * MAX_ACTIVE_PER_PARTNER;
  const partnerRemaining = Math.max(0, partnerCapacity - activeDeliveries);

  return { zoneOrders, storeOrders, activeDeliveries, onlinePartners, partnerCapacity, partnerRemaining };
};

const slotForDate = (slot, date, now, workload, zone, store, booked) => {
  const isAsap = slot.type === "ASAP";
  const start = new Date(date);
  const end = new Date(date);

  if (isAsap) {
    // ASAP is relative to the current time; its admin from/to values are not
    // used as a fixed clock window.
    start.setTime(now.getTime());
  } else {
    start.setHours(Math.floor(slot.fromMinutes / 60), slot.fromMinutes % 60, 0, 0);
    end.setHours(Math.floor(slot.toMinutes / 60), slot.toMinutes % 60, 0, 0);

    const cutoff = addMinutes(start, -Number(slot.cutoffMinutesBeforeStart || 0));
    if (dateKey(date) === dateKey(now) && now.getTime() >= cutoff.getTime()) return null;
    if (end <= now) return null;
  }

  const zoneRemaining = Math.max(0, Number(zone.maxConcurrentOrders) - workload.zoneOrders);
  const storeRemaining = Math.max(0, Number(store.maxConcurrentOrders) - workload.storeOrders);
  const slotRemaining = Math.max(0, Number(slot.capacity) - booked);
  const effectiveCapacity = Math.max(
    0,
    Math.min(slotRemaining, zoneRemaining, storeRemaining, workload.partnerRemaining),
  );

  if (effectiveCapacity <= 0) return null;

  const pressure = Math.max(workload.zoneOrders, workload.storeOrders);
  const workloadDelay = Math.min(
    30,
    Math.ceil(pressure / Math.max(1, Number(slot.capacity))) *
      Number(zone.workloadDelayMinutes || 0),
  );
  const prep = Number(store.prepMinutes || 0);
  const travel = Number(zone.travelMinutes || 0);
  const promisedAt = isAsap
    ? addMinutes(now, Number(slot.leadTimeMinutes || 0) + prep + travel + workloadDelay)
    : addMinutes(end, travel + workloadDelay);

  return {
    slotId: slot._id,
    dateKey: dateKey(date),
    label: slot.label,
    type: slot.type,
    window: isAsap
      ? `Within ${Math.max(1, Math.ceil((promisedAt - now) / 60000))} min`
      : `${pad(Math.floor(slot.fromMinutes / 60))}:${pad(slot.fromMinutes % 60)} - ${pad(Math.floor(slot.toMinutes / 60))}:${pad(slot.toMinutes % 60)}`,
    startsAt: start.toISOString(),
    endsAt: isAsap ? promisedAt.toISOString() : end.toISOString(),
    promisedAt: promisedAt.toISOString(),
    remainingCapacity: effectiveCapacity,
    capacity: Number(slot.capacity),
    booked,
    zone: { id: zone._id, name: zone.name },
    store: { id: store._id, name: store.name, code: store.code },
    workload: {
      zoneOrders: workload.zoneOrders,
      storeOrders: workload.storeOrders,
      onlinePartners: workload.onlinePartners,
      activeDeliveries: workload.activeDeliveries,
      partnerRemaining: workload.partnerRemaining,
    },
    cutoffAt: isAsap ? now.toISOString() : addMinutes(
      start,
      -Number(slot.cutoffMinutesBeforeStart || 0),
    ).toISOString(),
  };
};


export const getAvailableDeliverySlotsService = async (userId, addressId) => {
  const address = await Address.findOne({ _id: addressId, userId });
  if (!address) throw new AppError(404, "ADDRESS_NOT_FOUND", "Address not found");

  const zone = await resolveZone(address);
  const store = await resolveStore(address);
  const workload = await getWorkload(zone._id, store._id);
  const slots = await DeliverySlot.find({ active: true }).sort({ sortOrder: 1, fromMinutes: 1 }).lean();

  const now = new Date();
  const dates = [new Date(now), addMinutes(new Date(now), 24 * 60)];
  const dayRows = await DeliverySlotDay.find({
    slotId: { $in: slots.map((s) => s._id) },
    dateKey: { $in: dates.map(dateKey) },
  }).lean();
  const bookedMap = new Map(dayRows.map((row) => [`${row.slotId}:${row.dateKey}`, row.booked]));

  const candidates = [];
  for (const date of dates) {
    for (const slot of slots) {
      if (slot.type === "ASAP" && dateKey(date) !== dateKey(now)) continue;
      const item = slotForDate(slot, date, now, workload, zone, store, bookedMap.get(`${slot._id}:${dateKey(date)}`) || 0);
      if (item) candidates.push(item);
    }
  }

  return {
    addressId,
    zone: { id: zone._id, name: zone.name },
    store: { id: store._id, name: store.name, code: store.code },
    slots: candidates.slice(0, 12),
    generatedAt: now.toISOString(),
  };
};

export const reserveDeliverySlotService = async ({ userId, addressId, slotId, dateKey: requestedDateKey }) => {
  if (!slotId || !requestedDateKey) throw new AppError(400, "DELIVERY_SLOT_REQUIRED", "A delivery slot is required");

  const address = await Address.findOne({ _id: addressId, userId });
  if (!address) throw new AppError(404, "ADDRESS_NOT_FOUND", "Address not found");

  const zone = await resolveZone(address);
  const store = await resolveStore(address);
  const slot = await DeliverySlot.findOne({ _id: slotId, active: true });
  if (!slot) throw new AppError(404, "DELIVERY_SLOT_NOT_FOUND", "Delivery slot is no longer available");

  const now = new Date();
  const requestedDate = new Date(`${requestedDateKey}T00:00:00`);
  if (Number.isNaN(requestedDate.getTime())) throw new AppError(400, "INVALID_DELIVERY_DATE", "Invalid delivery date");

  const workload = await getWorkload(zone._id, store._id);
  const existingDay = await DeliverySlotDay.findOne({ slotId: slot._id, dateKey: requestedDateKey }).lean();
  const existingBooked = Number(existingDay?.booked || 0);
  const preview = slotForDate(slot.toObject(), requestedDate, now, workload, zone, store, existingBooked);

  if (!preview) {
    throw new AppError(409, "DELIVERY_SLOT_UNAVAILABLE", "This delivery slot is no longer available");
  }

  const day = await DeliverySlotDay.findOneAndUpdate(
    {
      slotId: slot._id,
      dateKey: requestedDateKey,
      $expr: { $lt: ["$booked", Number(slot.capacity)] },
    },
    { $inc: { booked: 1 } },
    { new: true, upsert: false }
  );

  if (!day) {
    if (existingBooked > 0) throw new AppError(409, "DELIVERY_SLOT_FULL", "This delivery slot just became unavailable");
    try {
      await DeliverySlotDay.create({ slotId: slot._id, dateKey: requestedDateKey, booked: 1 });
    } catch (error) {
      if (error?.code === 11000) throw new AppError(409, "DELIVERY_SLOT_FULL", "This delivery slot just became unavailable");
      throw error;
    }
  }

  return {
    slotId: slot._id,
    dateKey: requestedDateKey,
    label: slot.label,
    promisedAt: preview.promisedAt,
    startsAt: preview.startsAt,
    endsAt: preview.endsAt,
    zoneId: zone._id,
    storeId: store._id,
  };
};

export const releaseReservedDeliverySlotService = async (slotId, requestedDateKey) => {
  await DeliverySlotDay.findOneAndUpdate(
    { slotId, dateKey: requestedDateKey, booked: { $gt: 0 } },
    { $inc: { booked: -1 } }
  );
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

export const createDeliveryZoneService = async (userId, body) => DeliveryZone.create({ ...body, createdBy: userId, updatedBy: userId, pincodes: (body.pincodes || []).map((x) => String(x).trim()).filter(Boolean) });
export const getAllDeliveryZonesService = async () => DeliveryZone.find().sort({ name: 1 });
export const updateDeliveryZoneService = async (id, userId, body) => {
  const zone = await DeliveryZone.findById(id);
  if (!zone) throw new AppError(404, "DELIVERY_ZONE_NOT_FOUND", "Delivery zone not found");
  Object.assign(zone, body, { updatedBy: userId, pincodes: body.pincodes ? body.pincodes.map((x) => String(x).trim()).filter(Boolean) : zone.pincodes });
  await zone.save();
  return zone;
};
export const deleteDeliveryZoneService = async (id) => {
  const zone = await DeliveryZone.findById(id);
  if (!zone) throw new AppError(404, "DELIVERY_ZONE_NOT_FOUND", "Delivery zone not found");
  await zone.deleteOne();
};

export const createDeliveryStoreService = async (userId, body) => DeliveryStore.create({ ...body, createdBy: userId, updatedBy: userId, code: String(body.code).trim().toUpperCase() });
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
