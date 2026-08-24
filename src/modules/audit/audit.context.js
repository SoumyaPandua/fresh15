import { AsyncLocalStorage } from "node:async_hooks";
import crypto from "node:crypto";

const storage = new AsyncLocalStorage();

export const createAuditContext = (req) => ({
  req,
  requestId: req.get("x-request-id") || crypto.randomUUID(),
  ipAddress: null,
  userAgent: req.get("user-agent") || null,
  method: req.method,
  path: req.originalUrl || req.url,
  geo: {
    country: req.get("cf-ipcountry") || req.get("x-vercel-ip-country") || null,
    region: req.get("x-vercel-ip-country-region") || null,
    city: req.get("x-vercel-ip-city") || null,
  },
  auditWritten: false,
});

export const runAuditContext = (context, callback) => storage.run(context, callback);

export const getAuditContext = () => storage.getStore();

export const markAuditWritten = () => {
  const context = storage.getStore();
  if (context) context.auditWritten = true;
};
