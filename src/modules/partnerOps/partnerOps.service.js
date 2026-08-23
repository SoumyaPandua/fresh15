
import mongoose from "mongoose";
import User from "../user/user.model.js";
import Profile from "../profile/profile.model.js";
import Delivery from "../delivery/delivery.model.js";
import Order from "../order/order.model.js";
import PartnerShift from "./partnerShift.model.js";
import PartnerEarning from "./partnerEarning.model.js";
import PartnerIncentive from "./partnerIncentive.model.js";
import PartnerCashLedger from "./partnerCashLedger.model.js";
import PartnerDocument from "./partnerDocument.model.js";
import PartnerIncident from "./partnerIncident.model.js";
import AppError from "../../utils/AppError.js";

const ACTIVE_DELIVERY_STATUSES = [
  "ASSIGNED",
  "ACCEPTED",
  "PICKED_UP",
  "OUT_FOR_DELIVERY",
];

const round = (n) => Number(Number(n || 0).toFixed(2));

const ensurePartner = async (partnerId) => {
  const user = await User.findOne({
    _id: partnerId,
    role: "PARTNER",
    portal: "partner",
  }).select("_id name email phone profileImage currentLocation isOnline isActive");

  if (!user) {
    throw new AppError(404, "PARTNER_NOT_FOUND", "Delivery partner not found");
  }

  return user;
};

const normalizePause = async (partnerId) => {
  const profile = await Profile.findOne({ userId: partnerId, role: "PARTNER" });
  if (!profile) return null;

  if (profile.isPaused && profile.pauseUntil && new Date(profile.pauseUntil) <= new Date()) {
    profile.isPaused = false;
    profile.pauseUntil = null;
    profile.pauseReason = "";
    profile.deliveryStatus = profile.currentDeliveryId
      ? "BUSY"
      : profile.isOnline
        ? "AVAILABLE"
        : "OFFLINE";
    await profile.save();
  }

  return profile;
};

const haversineKm = (aLat, aLng, bLat, bLng) => {
  const lat1 = Number(aLat);
  const lon1 = Number(aLng);
  const lat2 = Number(bLat);
  const lon2 = Number(bLng);

  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return null;

  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const dateKey = (d = new Date()) =>
  new Date(d).toISOString().slice(0, 10);

const shiftState = (shift) => {
  if (!shift) return null;

  const now = Date.now();
  const start = new Date(shift.startAt).getTime();
  const end = new Date(shift.endAt).getTime();

  if (shift.status === "SCHEDULED" && start <= now && end > now) return "ACTIVE";
  if (shift.status === "SCHEDULED" && end <= now) return "COMPLETED";
  return shift.status;
};

export const getQueueService = async (partnerId) => {
  const partner = await ensurePartner(partnerId);
  const deliveries = await Delivery.find({
    riderId: partnerId,
    status: { $in: ACTIVE_DELIVERY_STATUSES },
  })
    .populate({
      path: "orderId",
      populate: { path: "addressId" },
    })
    .sort({ assignedAt: 1 })
    .lean();

  const pLat = Number(partner.currentLocation?.latitude);
  const pLng = Number(partner.currentLocation?.longitude);

  const rows = deliveries.map((delivery) => {
    const address =
      delivery.orderId &&
      typeof delivery.orderId === "object" &&
      delivery.orderId.addressId &&
      typeof delivery.orderId.addressId === "object"
        ? delivery.orderId.addressId
        : null;

    const distanceKm = haversineKm(
      pLat,
      pLng,
      address?.latitude,
      address?.longitude
    );

    return {
      deliveryId: delivery._id,
      orderId: delivery.orderId?._id ?? delivery.orderId,
      orderNumber: delivery.orderId?.orderNumber ?? null,
      status: delivery.status,
      assignedAt: delivery.assignedAt,
      acceptanceDeadlineAt: delivery.acceptanceDeadlineAt,
      promisedDeliveryAt: delivery.orderId?.promisedDeliveryAt ?? null,
      customer: {
        name:
          delivery.orderId?.userId &&
          typeof delivery.orderId.userId === "object"
            ? delivery.orderId.userId.name
            : null,
        address,
      },
      distanceKm: distanceKm === null ? null : round(distanceKm),
    };
  });

  rows.sort((a, b) => {
    if (a.status === "OUT_FOR_DELIVERY" && b.status !== "OUT_FOR_DELIVERY") return -1;
    if (b.status === "OUT_FOR_DELIVERY" && a.status !== "OUT_FOR_DELIVERY") return 1;
    if (a.distanceKm !== null && b.distanceKm !== null && a.distanceKm !== b.distanceKm) {
      return a.distanceKm - b.distanceKm;
    }
    return new Date(a.promisedDeliveryAt || a.assignedAt || 0) -
      new Date(b.promisedDeliveryAt || b.assignedAt || 0);
  });

  return {
    currentLocation:
      Number.isFinite(pLat) && Number.isFinite(pLng)
        ? { latitude: pLat, longitude: pLng }
        : null,
    nextStop: rows[0] ?? null,
    stops: rows,
    generatedAt: new Date().toISOString(),
  };
};

export const getEarningsService = async (partnerId, query = {}) => {
  await ensurePartner(partnerId);

  const from = query.from ? new Date(query.from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const to = query.to ? new Date(query.to) : new Date();

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new AppError(400, "INVALID_DATE_RANGE", "Invalid earnings date range");
  }

  to.setHours(23, 59, 59, 999);

  const [ledger, delivered] = await Promise.all([
    PartnerEarning.find({
      partnerId,
      createdAt: { $gte: from, $lte: to },
    })
      .populate("orderId", "orderNumber")
      .sort({ createdAt: -1 })
      .lean(),
    Delivery.find({
      riderId: partnerId,
      status: "DELIVERED",
      deliveredAt: { $gte: from, $lte: to },
    })
      .select("_id orderId earning deliveryCharge deliveredAt")
      .populate("orderId", "orderNumber")
      .sort({ deliveredAt: -1 })
      .lean(),
  ]);

  const orderEarnings = ledger.filter((x) => x.type === "ORDER");
  const incentives = ledger.filter((x) => x.type === "INCENTIVE");
  const adjustments = ledger.filter((x) => x.type === "ADJUSTMENT");

  const baseOrders = orderEarnings.length
    ? orderEarnings
    : delivered.map((d) => ({
        _id: d._id,
        type: "ORDER",
        amount: Number(d.earning ?? d.deliveryCharge ?? 0),
        title: `Delivery ${d.orderId?.orderNumber ?? d._id.toString().slice(-6)}`,
        description: "Base delivery earning",
        createdAt: d.deliveredAt,
        orderId: d.orderId,
      }));

  const now = new Date();
  const activeIncentiveRows = await PartnerIncentive.find({
    active: true,
    startAt: { $lte: now },
    endAt: { $gte: now },
    $or: [{ partnerId: null }, { partnerId }],
  }).lean();

  const activeIncentives = await Promise.all(
    activeIncentiveRows.map(async (incentive) => {
      const progress = await Delivery.countDocuments({
        riderId: partnerId,
        status: "DELIVERED",
        deliveredAt: { $gte: incentive.startAt, $lte: incentive.endAt },
      });

      return {
        _id: incentive._id,
        title: incentive.title,
        description: incentive.description,
        amount: round(incentive.amount),
        targetDeliveries: incentive.targetDeliveries,
        progress,
        remaining: Math.max(0, incentive.targetDeliveries - progress),
        startAt: incentive.startAt,
        endAt: incentive.endAt,
        completed: progress >= incentive.targetDeliveries,
      };
    }),
  );

  const totals = {
    orders: round(baseOrders.reduce((s, x) => s + Number(x.amount || 0), 0)),
    incentives: round(incentives.reduce((s, x) => s + Number(x.amount || 0), 0)),
    adjustments: round(adjustments.reduce((s, x) => s + Number(x.amount || 0), 0)),
  };

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    totals: {
      ...totals,
      total: round(totals.orders + totals.incentives + totals.adjustments),
    },
    activeIncentives,
    ledger: [...baseOrders, ...incentives, ...adjustments].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    ),
  };
};

export const recordDeliveredOrderEarningsService = async (delivery) => {
  if (!delivery?.riderId || delivery.status !== "DELIVERED") return;

  const amount = round(delivery.earning ?? delivery.deliveryCharge ?? 0);

  try {
    await PartnerEarning.create({
      partnerId: delivery.riderId,
      deliveryId: delivery._id,
      orderId: delivery.orderId,
      type: "ORDER",
      amount,
      title: "Delivery earning",
      description: "Base earning for completed delivery",
      createdBy: delivery.riderId,
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;
  }

  await evaluatePartnerIncentivesService(delivery.riderId);
};

export const evaluatePartnerIncentivesService = async (partnerId) => {
  const now = new Date();

  const incentives = await PartnerIncentive.find({
    active: true,
    startAt: { $lte: now },
    endAt: { $gte: now },
    $or: [{ partnerId: null }, { partnerId }],
  }).lean();

  for (const incentive of incentives) {
    const deliveredCount = await Delivery.countDocuments({
      riderId: partnerId,
      status: "DELIVERED",
      deliveredAt: {
        $gte: incentive.startAt,
        $lte: incentive.endAt,
      },
    });

    if (deliveredCount < incentive.targetDeliveries) continue;

    try {
      await PartnerEarning.create({
        partnerId,
        incentiveId: incentive._id,
        type: "INCENTIVE",
        amount: round(incentive.amount),
        title: incentive.title,
        description:
          incentive.description ||
          `Completed ${incentive.targetDeliveries} deliveries`,
        metadata: {
          targetDeliveries: incentive.targetDeliveries,
          completedDeliveries: deliveredCount,
          startAt: incentive.startAt,
          endAt: incentive.endAt,
        },
        createdBy: partnerId,
      });
    } catch (error) {
      if (error?.code !== 11000) throw error;
    }
  }
};

export const getCashService = async (partnerId) => {
  await ensurePartner(partnerId);

  const ledger = await PartnerCashLedger.find({
    partnerId,
  })
    .populate("orderId", "orderNumber grandTotal")
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  const collected = round(
    ledger
      .filter((x) => x.type === "COD_COLLECTION")
      .reduce((s, x) => s + Number(x.amount || 0), 0)
  );

  const reconciled = round(
    ledger
      .filter((x) => x.type === "RECONCILIATION")
      .reduce((s, x) => s + Math.abs(Number(x.amount || 0)), 0)
  );

  const adjustments = round(
    ledger
      .filter((x) => x.type === "ADJUSTMENT")
      .reduce((s, x) => s + Number(x.amount || 0), 0)
  );

  return {
    cashInHand: round(collected - reconciled + adjustments),
    totalCollected: collected,
    totalReconciled: reconciled,
    adjustments,
    ledger,
  };
};

export const recordCashCollectionService = async ({
  partnerId,
  deliveryId,
  orderId,
  amount,
  createdBy,
}) => {
  try {
    await PartnerCashLedger.create({
      partnerId,
      deliveryId,
      orderId,
      type: "COD_COLLECTION",
      amount: round(amount),
      note: "COD cash collected from customer",
      createdBy,
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;
  }
};

export const reconcileCashService = async (partnerId, amount, note) => {
  const cash = await getCashService(partnerId);
  const requested = round(amount);

  if (requested > cash.cashInHand + 0.01) {
    throw new AppError(
      409,
      "CASH_RECONCILIATION_EXCEEDS_BALANCE",
      `You can reconcile up to ₹${cash.cashInHand.toFixed(2)}`
    );
  }

  const row = await PartnerCashLedger.create({
    partnerId,
    type: "RECONCILIATION",
    amount: -requested,
    note: note || "Cash handed over to Fresh15",
    createdBy: partnerId,
  });

  return {
    entry: row,
    cashInHand: round(cash.cashInHand - requested),
  };
};

export const getShiftsService = async (partnerId) => {
  await ensurePartner(partnerId);

  const shifts = await PartnerShift.find({
    partnerId,
    endAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  })
    .sort({ startAt: 1 })
    .limit(50)
    .lean();

  return shifts.map((shift) => ({
    ...shift,
    status: shiftState(shift),
  }));
};

export const createShiftService = async (partnerId, body) => {
  await ensurePartner(partnerId);

  const start = new Date(body.startAt);
  const end = new Date(body.endAt);

  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
    throw new AppError(400, "INVALID_SHIFT", "Shift end must be after shift start");
  }

  const hours = (end - start) / 3600000;
  if (hours > 12) {
    throw new AppError(400, "SHIFT_TOO_LONG", "A shift cannot be longer than 12 hours");
  }

  if (start < new Date()) {
    throw new AppError(400, "SHIFT_IN_PAST", "Shift must start in the future");
  }

  const overlapping = await PartnerShift.findOne({
    partnerId,
    status: { $in: ["SCHEDULED", "ACTIVE"] },
    startAt: { $lt: end },
    endAt: { $gt: start },
  });

  if (overlapping) {
    throw new AppError(409, "SHIFT_OVERLAP", "This shift overlaps an existing scheduled shift");
  }

  return PartnerShift.create({
    partnerId,
    dateKey: body.dateKey,
    startAt: start,
    endAt: end,
    note: body.note || "",
    createdBy: partnerId,
  });
};

export const cancelShiftService = async (partnerId, id) => {
  const shift = await PartnerShift.findOne({ _id: id, partnerId });
  if (!shift) throw new AppError(404, "SHIFT_NOT_FOUND", "Shift not found");
  if (shift.status === "COMPLETED") throw new AppError(409, "SHIFT_COMPLETED", "Completed shift cannot be cancelled");
  if (new Date(shift.startAt) <= new Date()) throw new AppError(409, "SHIFT_STARTED", "Started shift cannot be cancelled");

  shift.status = "CANCELLED";
  shift.updatedBy = partnerId;
  await shift.save();
  return shift;
};

export const getDocumentsService = async (partnerId) => {
  await ensurePartner(partnerId);

  const profile = await Profile.findOne({ userId: partnerId }).lean();

  const defaults = [
    { type: "DRIVING_LICENSE", documentNumber: profile?.drivingLicenseNumber || "" },
    { type: "RC", documentNumber: "" },
    { type: "INSURANCE", documentNumber: "" },
    { type: "PAN", documentNumber: "" },
  ];

  for (const item of defaults) {
    await PartnerDocument.updateOne(
      { partnerId, type: item.type },
      {
        $setOnInsert: {
          partnerId,
          ...item,
          createdBy: partnerId,
        },
      },
      { upsert: true }
    );
  }

  const docs = await PartnerDocument.find({ partnerId }).sort({ type: 1 }).lean();
  const now = Date.now();

  return docs.map((doc) => {
    const expires = doc.expiresAt ? new Date(doc.expiresAt).getTime() : null;
    const daysRemaining =
      expires === null
        ? null
        : Math.ceil((expires - now) / 86400000);

    return {
      ...doc,
      daysRemaining,
      expiryState:
        expires === null
          ? "NOT_SET"
          : daysRemaining < 0
            ? "EXPIRED"
            : daysRemaining <= 30
              ? "EXPIRING_SOON"
              : "VALID",
    };
  });
};

export const upsertDocumentService = async (partnerId, body) => {
  await ensurePartner(partnerId);

  const doc = await PartnerDocument.findOneAndUpdate(
    { partnerId, type: body.type },
    {
      $set: {
        documentNumber: body.documentNumber || "",
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        status: body.status || "PENDING",
        fileUrl: body.fileUrl || "",
        notes: body.notes || "",
        updatedBy: partnerId,
      },
      $setOnInsert: {
        partnerId,
        type: body.type,
        createdBy: partnerId,
      },
    },
    { new: true, upsert: true, runValidators: true }
  );

  return doc;
};

export const pausePartnerService = async (partnerId, minutes = 30, reason = "") => {
  const profile = await Profile.findOne({ userId: partnerId, role: "PARTNER" });
  if (!profile) throw new AppError(404, "PARTNER_PROFILE_NOT_FOUND", "Partner profile not found");

  if (profile.currentDeliveryId) {
    throw new AppError(409, "ACTIVE_DELIVERY", "Finish your active delivery before taking a break");
  }

  if (!profile.isOnline) {
    throw new AppError(409, "PARTNER_OFFLINE", "Go online before starting a break");
  }

  const until = new Date(Date.now() + Math.min(60, Math.max(5, Number(minutes) || 30)) * 60000);

  profile.isPaused = true;
  profile.pauseUntil = until;
  profile.pauseReason = String(reason || "").slice(0, 200);
  profile.deliveryStatus = "PAUSED";
  await profile.save();

  return {
    isPaused: true,
    pauseUntil: until,
    pauseReason: profile.pauseReason,
    deliveryStatus: profile.deliveryStatus,
  };
};

export const resumePartnerService = async (partnerId) => {
  const profile = await Profile.findOne({ userId: partnerId, role: "PARTNER" });
  if (!profile) throw new AppError(404, "PARTNER_PROFILE_NOT_FOUND", "Partner profile not found");

  profile.isPaused = false;
  profile.pauseUntil = null;
  profile.pauseReason = "";
  profile.deliveryStatus = profile.currentDeliveryId
    ? "BUSY"
    : profile.isOnline
      ? "AVAILABLE"
      : "OFFLINE";

  await profile.save();

  return {
    isPaused: false,
    pauseUntil: null,
    pauseReason: "",
    deliveryStatus: profile.deliveryStatus,
  };
};

export const getOverviewService = async (partnerId) => {
  const profile = await normalizePause(partnerId);
  const user = await ensurePartner(partnerId);
  const [queue, cash, earnings, shifts, documents, activeDelivery] = await Promise.all([
    getQueueService(partnerId),
    getCashService(partnerId),
    getEarningsService(partnerId, { from: new Date(new Date().setHours(0, 0, 0, 0)).toISOString() }),
    getShiftsService(partnerId),
    getDocumentsService(partnerId),
    Delivery.findOne({
      riderId: partnerId,
      status: { $in: ACTIVE_DELIVERY_STATUSES },
    }).select("status assignedAt acceptanceDeadlineAt earning deliveryCharge orderId"),
  ]);

  return {
    partner: {
      id: user._id,
      name: user.name,
      isOnline: user.isOnline,
      isPaused: Boolean(profile?.isPaused),
      pauseUntil: profile?.pauseUntil ?? null,
      pauseReason: profile?.pauseReason ?? "",
      deliveryStatus: profile?.deliveryStatus ?? "OFFLINE",
    },
    activeDelivery,
    nextStop: queue.nextStop,
    queue,
    cash,
    earnings,
    upcomingShifts: shifts.slice(0, 5),
    documents: documents.filter((d) => d.expiryState === "EXPIRED" || d.expiryState === "EXPIRING_SOON" || d.expiryState === "NOT_SET"),
  };
};

export const createIncidentService = async (partnerId, body) => {
  await ensurePartner(partnerId);

  if (body.deliveryId) {
    const delivery = await Delivery.findOne({
      _id: body.deliveryId,
      riderId: partnerId,
    });
    if (!delivery) throw new AppError(403, "DELIVERY_NOT_ASSIGNED", "You can only attach an incident to your own delivery");
  }

  if (body.orderId) {
    const order = await Order.findOne({
      _id: body.orderId,
      ...(body.deliveryId ? {} : { userId: { $exists: true } }),
    });
    if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");
  }

  return PartnerIncident.create({
    partnerId,
    deliveryId: body.deliveryId || null,
    orderId: body.orderId || null,
    type: body.type,
    severity: body.severity || "MEDIUM",
    description: body.description,
    latitude: body.latitude ?? null,
    longitude: body.longitude ?? null,
  });
};

export const getIncidentsService = async (partnerId) => {
  await ensurePartner(partnerId);
  return PartnerIncident.find({ partnerId }).sort({ createdAt: -1 }).limit(100).lean();
};

/* --------------------------- Admin / Platform --------------------------- */

export const getAdminPartnerOpsOverviewService = async () => {
  const now = new Date();

  const [openIncidents, expiringDocuments, cashAgg, activeShifts, activeIncentives] =
    await Promise.all([
      PartnerIncident.countDocuments({ status: { $in: ["OPEN", "IN_REVIEW"] } }),
      PartnerDocument.countDocuments({
        expiresAt: { $ne: null, $lte: new Date(now.getTime() + 30 * 86400000) },
        status: { $ne: "REJECTED" },
      }),
      PartnerCashLedger.aggregate([
        { $match: { type: "COD_COLLECTION" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      PartnerShift.countDocuments({
        status: "SCHEDULED",
        startAt: { $lte: new Date(now.getTime() + 24 * 86400000) },
        endAt: { $gte: now },
      }),
      PartnerIncentive.countDocuments({
        active: true,
        startAt: { $lte: now },
        endAt: { $gte: now },
      }),
    ]);

  return {
    openIncidents,
    expiringDocuments,
    totalCashCollected: round(cashAgg[0]?.total || 0),
    activeShifts,
    activeIncentives,
  };
};

export const getAdminIncidentsService = async (query = {}) => {
  const limit = Math.min(200, Math.max(1, Number(query.limit) || 100));
  return PartnerIncident.find(
    query.status ? { status: query.status } : {}
  )
    .populate("partnerId", "name phone email")
    .populate("orderId", "orderNumber")
    .populate("deliveryId", "status")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

export const resolveIncidentService = async (id, adminId, status, resolutionNote) => {
  const incident = await PartnerIncident.findById(id);
  if (!incident) throw new AppError(404, "INCIDENT_NOT_FOUND", "Incident not found");

  incident.status = status;
  incident.resolutionNote = resolutionNote || "";
  incident.resolvedAt = status === "RESOLVED" ? new Date() : null;
  incident.resolvedBy = status === "RESOLVED" ? adminId : null;
  await incident.save();

  return incident;
};

export const getAdminShiftsService = async (query = {}) => {
  const limit = Math.min(200, Math.max(1, Number(query.limit) || 100));
  return PartnerShift.find(
    query.dateKey ? { dateKey: query.dateKey } : {}
  )
    .populate("partnerId", "name phone email")
    .sort({ startAt: 1 })
    .limit(limit)
    .lean();
};

export const getAdminCashService = async (query = {}) => {
  const limit = Math.min(200, Math.max(1, Number(query.limit) || 100));
  return PartnerCashLedger.find({})
    .populate("partnerId", "name phone email")
    .populate("orderId", "orderNumber")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

export const createIncentiveService = async (adminId, body) => {
  const startAt = new Date(body.startAt);
  const endAt = new Date(body.endAt);

  if (!Number.isFinite(startAt.getTime()) || !Number.isFinite(endAt.getTime()) || endAt <= startAt) {
    throw new AppError(400, "INVALID_INCENTIVE", "Incentive end must be after start");
  }

  return PartnerIncentive.create({
    title: body.title,
    description: body.description || "",
    amount: Number(body.amount),
    targetDeliveries: Number(body.targetDeliveries),
    startAt,
    endAt,
    partnerId: body.partnerId || null,
    createdBy: adminId,
    updatedBy: adminId,
  });
};
