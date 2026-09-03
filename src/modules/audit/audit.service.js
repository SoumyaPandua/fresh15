import Audit from "./audit.model.js";
import { getAuditContext, markAuditWritten } from "./audit.context.js";

const SENSITIVE_KEYS = /^(password|pass|pwd|token|access.?token|refresh.?token|authorization|cookie|set.?cookie|otp|secret|api.?key|apikey|private.?key|client.?secret|reset.?token|reset.?jti|razorpay.?signature|signature|cvv|cvc|card.?number|upi.?pin|bank.?account|account.?number|security.?answer)$/i;
const PII_KEYS = /^(email|phone|mobile|full.?name|first.?name|last.?name|address|addressLine1|addressLine2|street|pincode|postal.?code|vehicle.?registration.?number|registration.?number)$/i;
const SECRET_VALUE = /^(bearer\s+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$)/i;

const cleanString = (value, max = 2000) => String(value)
  .replace(/[\u0000-\u001f\u007f]/g, " ")
  .slice(0, max);

export const sanitizeDetails = (value) => {
  const seen = new WeakSet();
  const sanitize = (current, depth = 0) => {
    if (depth > 8) return "[TRUNCATED]";
    if (typeof current === "string") {
      const cleaned = cleanString(current);
      return SECRET_VALUE.test(cleaned) ? "[REDACTED]" : cleaned;
    }
    if (typeof current === "number" || typeof current === "boolean" || current === null) return current;
    if (typeof current !== "object") return "[REDACTED]";
    if (seen.has(current)) return "[CIRCULAR]";
    seen.add(current);

    if (Array.isArray(current)) return current.slice(0, 50).map((item) => sanitize(item, depth + 1));

    return Object.fromEntries(
      Object.entries(current).slice(0, 100).map(([key, item]) => {
        if (SENSITIVE_KEYS.test(key) || PII_KEYS.test(key)) return [key, "[REDACTED]"];
        return [cleanString(key, 120), sanitize(item, depth + 1)];
      }),
    );
  };

  try {
    return sanitize(value);
  } catch {
    return {};
  }
};

const safePath = (value) => String(value || "/").split("?")[0].slice(0, 500);

export const writeAuditLog = async ({
  actorId = null,
  action,
  resourceType,
  resourceId = null,
  details = {},
  outcome,
  statusCode,
  severity = "INFO",
  source = "api",
}) => {
  try {
    const context = getAuditContext();
    const log = await Audit.create({
      actorId: actorId || null,
      actorRole: context?.req?.user?.role ?? null,
      action: cleanString(action || "UNKNOWN", 120),
      resourceType: cleanString(resourceType || "Resource", 120),
      resourceId: resourceId || null,
      details: sanitizeDetails(details),
      requestId: cleanString(context?.requestId || "", 128) || null,
      ipAddress: context?.ipAddress || null,
      userAgent: context?.userAgent || null,
      method: cleanString(context?.method || "", 16) || null,
      path: safePath(context?.path),
      statusCode: statusCode ?? null,
      outcome: outcome ?? (statusCode != null ? (statusCode < 400 ? "SUCCESS" : "FAILURE") : "UNKNOWN"),
      severity,
      source: cleanString(source || "api", 32),
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

  if (action) query.action = cleanString(action, 120);
  if (resourceType) query.resourceType = cleanString(resourceType, 120);
  if (ip) query.ipAddress = { $regex: String(ip).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };

  const [logs, total] = await Promise.all([
    Audit.find(query).populate("actorId", "name email role").sort({ createdAt: -1 }).skip((safePage - 1) * safeLimit).limit(safeLimit).lean(),
    Audit.countDocuments(query),
  ]);

  let items = logs.map((log) => {
    const actor = log.actorId || {};
    const resource = log.resourceType || "Resource";
    return {
      id: String(log._id),
      actor: actor.name || actor.email || "System",
      actorId: actor._id ? String(actor._id) : null,
      actorRole: actor.role || log.actorRole || null,
      action: log.action,
      target: log.resourceId ? `#${String(log.resourceId).slice(-8)}` : resource,
      resourceType: resource,
      resourceId: log.resourceId ? String(log.resourceId) : null,
      at: log.createdAt,
      ip: log.ipAddress || "—",
      userAgent: log.userAgent || "—",
      method: log.method || "—",
      path: log.path || "—",
      statusCode: log.statusCode ?? null,
      outcome: log.outcome || "UNKNOWN",
      severity: log.severity || "INFO",
      requestId: log.requestId || null,
      geo: log.geo || {},
      details: log.details || {},
    };
  });

  if (search.trim()) {
    const q = search.trim().toLowerCase();
    items = items.filter((item) =>
      `${item.actor} ${item.action} ${item.target} ${item.resourceType} ${item.ip} ${item.path} ${item.requestId || ""} ${item.geo?.country || ""} ${item.geo?.city || ""}`
        .toLowerCase()
        .includes(q),
    );
  }

  return {
    items,
    pagination: { page: safePage, limit: safeLimit, total, pages: Math.max(1, Math.ceil(total / safeLimit)) },
  };
};
