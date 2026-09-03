import { AsyncLocalStorage } from "node:async_hooks";
import crypto from "node:crypto";

const storage = new AsyncLocalStorage();

const safeRequestId = (value) => {
  const input = String(value || "").trim();
  if (!input || input.length > 128 || !/^[a-zA-Z0-9._:-]+$/.test(input)) return crypto.randomUUID();
  return input;
};
const safePath = (value) => String(value || "/").split("?")[0].slice(0, 500);
const safeHeader = (value, max = 512) => {
  const text = String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  return text.length > max ? text.slice(0, max) : text || null;
};

export const createAuditContext = (req) => ({
  req,
  requestId: safeRequestId(req.get("x-request-id") || req.requestId),
  ipAddress: req.ip || req.socket?.remoteAddress || null,
  userAgent: safeHeader(req.get("user-agent")),
  method: req.method,
  path: safePath(req.originalUrl || req.url),
  geo: {
    country: safeHeader(req.get("cf-ipcountry"), 32),
    region: safeHeader(req.get("x-vercel-ip-country-region"), 64),
    city: safeHeader(req.get("x-vercel-ip-city"), 128),
  },
  traceId: req.traceId || null,
  spanId: req.spanId || null,
  auditWritten: false,
});

export const runAuditContext = (context, callback) => storage.run(context, callback);
export const getAuditContext = () => storage.getStore();
export const markAuditWritten = () => {
  const context = storage.getStore();
  if (context) context.auditWritten = true;
};
