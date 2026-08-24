import crypto from "node:crypto";
import { createAuditContext, runAuditContext } from "../modules/audit/audit.context.js";
import { writeAuditLog } from "../modules/audit/audit.service.js";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const IGNORED_PREFIXES = [
  "/api/audit",
  "/api/cart",
  "/api/wishlist",
];

const resourceName = (path) => {
  const parts = path.split("?")[0].split("/").filter(Boolean);
  const apiIndex = parts.indexOf("api");
  const module = apiIndex >= 0 ? parts[apiIndex + 1] : parts[0];
  if (!module) return "API";
  return module
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\s/g, "");
};

const resourceId = (req) => {
  if (req.params?.id) return req.params.id;
  if (req.params?.orderId) return req.params.orderId;
  if (req.params?.productId) return req.params.productId;
  if (req.params?.refundId) return req.params.refundId;
  return null;
};

const shouldAutoAudit = (req, res, context) => {
  if (!req.user) return false;
  if (!MUTATING_METHODS.has(req.method)) return false;
  if (res.statusCode < 200 || res.statusCode >= 500) return false;
  if (IGNORED_PREFIXES.some((prefix) => context.path.startsWith(prefix))) return false;
  if (context.auditWritten) return false;
  return true;
};

export default function auditContextMiddleware(req, res, next) {
  const context = createAuditContext(req);
  context.ipAddress = req.ip || req.socket?.remoteAddress || null;

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
        },
      });
    });

    next();
  });
}
