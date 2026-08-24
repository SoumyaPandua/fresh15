import Audit from "./audit.model.js";

export const writeAuditLog = async ({ actorId, action, resourceType, resourceId = null, details = {} }) => {
  try {
    return await Audit.create({ actorId, action, resourceType, resourceId, details });
  } catch (error) {
    console.error("Audit log failed:", error.message);
    return null;
  }
};

export const getAdminAuditLogsService = async ({ page = 1, limit = 100, search = "", action = "" } = {}) => {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 100));

  const query = {};
  if (action) query.action = action;

  const [logs, total] = await Promise.all([
    Audit.find(query)
      .populate("actorId", "name email role")
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    Audit.countDocuments(query),
  ]);

  let items = logs.map((log) => {
    const details = log.details && typeof log.details === "object" ? log.details : {};
    const actor = log.actorId || {};
    const actorName = actor.name || actor.email || "System";
    const resource = log.resourceType || "Resource";
    const target = log.resourceId ? `#${String(log.resourceId).slice(-8)}` : resource;

    return {
      id: String(log._id),
      actor: actorName,
      actorId: actor._id ? String(actor._id) : null,
      action: log.action,
      target,
      resourceType: resource,
      resourceId: log.resourceId ? String(log.resourceId) : null,
      at: log.createdAt,
      ip: details.ip || details.ipAddress || "—",
      details,
    };
  });

  if (search.trim()) {
    const q = search.trim().toLowerCase();
    items = items.filter((item) =>
      `${item.actor} ${item.action} ${item.target} ${item.resourceType} ${item.ip}`
        .toLowerCase()
        .includes(q)
    );
  }

  return {
    items,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.max(1, Math.ceil(total / safeLimit)),
    },
  };
};
