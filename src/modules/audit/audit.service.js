import Audit from "./audit.model.js";
import { getAuditContext, markAuditWritten } from "./audit.context.js";

const sanitizeDetails = (value) => {
  if (!value || typeof value !== "object") return value;
  try {
    const json = JSON.stringify(value, (_key, current) => {
      if (typeof current === "string" && current.length > 2000) return current.slice(0, 2000);
      return current;
    });
    return JSON.parse(json);
  } catch {
    return {};
  }
};

export const writeAuditLog = async ({
  actorId = null,
  action,
  resourceType,
  resourceId = null,
  details = {},
  outcome,
  statusCode,
  source = "api",
}) => {
  try {
    const context = getAuditContext();
    const resolvedActorId = actorId || null;
    const log = await Audit.create({
      actorId: resolvedActorId,
      actorRole: context?.req?.user?.role ?? null,
      action,
      resourceType,
      resourceId: resourceId || null,
      details: sanitizeDetails(details),
      requestId: context?.requestId ?? null,
      ipAddress: context?.ipAddress ?? null,
      userAgent: context?.userAgent ?? null,
      method: context?.method ?? null,
      path: context?.path ?? null,
      statusCode: statusCode ?? null,
      outcome: outcome ?? (statusCode != null ? (statusCode < 400 ? "SUCCESS" : "FAILURE") : "UNKNOWN"),
      source,
      geo: context?.geo ?? {},
    });
    markAuditWritten();
    return log;
  } catch (error) {
    console.error("Audit log failed:", error.message);
    return null;
  }
};

export const getAdminAuditLogsService = async ({
  page = 1,
  limit = 100,
  search = "",
  action = "",
  resourceType = "",
  ip = "",
} = {}) => {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 100));

  const query = {};
  if (action) query.action = action;
  if (resourceType) query.resourceType = resourceType;
  if (ip) query.ipAddress = { $regex: ip.trim(), $options: "i" };

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
    const actor = log.actorId || {};
    const actorName = actor.name || actor.email || "System";
    const resource = log.resourceType || "Resource";
    const target = log.resourceId ? `#${String(log.resourceId).slice(-8)}` : resource;

    return {
      id: String(log._id),
      actor: actorName,
      actorId: actor._id ? String(actor._id) : null,
      actorRole: actor.role || log.actorRole || null,
      action: log.action,
      target,
      resourceType: resource,
      resourceId: log.resourceId ? String(log.resourceId) : null,
      at: log.createdAt,
      ip: log.ipAddress || log.details?.ip || log.details?.ipAddress || "—",
      userAgent: log.userAgent || "—",
      method: log.method || "—",
      path: log.path || "—",
      statusCode: log.statusCode ?? null,
      outcome: log.outcome || "UNKNOWN",
      requestId: log.requestId || null,
      geo: log.geo || {},
      details: log.details || {},
    };
  });

  if (search.trim()) {
    const q = search.trim().toLowerCase();
    items = items.filter((item) =>
      `${item.actor} ${item.action} ${item.target} ${item.resourceType} ${item.ip} ${item.path} ${item.requestId ?? ""} ${item.geo?.country ?? ""} ${item.geo?.city ?? ""}`
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
