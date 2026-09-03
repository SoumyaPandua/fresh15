import { createAuditContext, runAuditContext } from "../modules/audit/audit.context.js";
import { writeAuditLog } from "../modules/audit/audit.service.js";
import { getRequestContext } from "./request-context.middleware.js";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const IGNORED_PREFIXES = ["/api/audit", "/api/cart", "/api/wishlist"];

const resourceName = (path) => {
  const parts = path.split("?")[0].split("/").filter(Boolean);
  const apiIndex = parts.indexOf("api");
  const module = apiIndex >= 0 ? parts[apiIndex + 1] : parts[0];
  if (!module) return "API";
  return module.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\s/g, "");
};

const resourceId = (req) => req.params?.id || req.params?.orderId || req.params?.productId || req.params?.refundId || null;

const shouldAutoAudit = (req, res, context) =>
  Boolean(req.user) &&
  MUTATING_METHODS.has(req.method) &&
  res.statusCode >= 200 &&
  res.statusCode < 500 &&
  !IGNORED_PREFIXES.some((prefix) => context.path.startsWith(prefix)) &&
  !context.auditWritten;

export default function auditContextMiddleware(req, res, next) {
  const context = createAuditContext(req);
  const request = getRequestContext();
  context.requestId = request?.requestId || context.requestId;
  context.traceId = request?.traceId || null;
  context.spanId = request?.spanId || null;

  res.setHeader("X-Request-Id", context.requestId);

  runAuditContext(context, () => {
    res.on("finish", () => {
      if (!shouldAutoAudit(req, res, context)) return;
      void writeAuditLog({
        actorId: req.user?._id ?? null,
        action: `API_MUTATION_${req.method}`,
        resourceType: resourceName(context.path),
        resourceId: resourceId(req),
        details: {
          statusCode: res.statusCode,
          outcome: res.statusCode < 400 ? "SUCCESS" : "FAILURE",
          automatic: true,
          traceId: context.traceId,
          spanId: context.spanId,
        },
      });
    });
    next();
  });
}
