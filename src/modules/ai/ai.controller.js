import sendResponse from "../../utils/sendResponse.js";
import { chatWithFresh15 } from "./ai.service.js";
import { writeAuditLog } from "../audit/audit.service.js";

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 10;
const buckets = new Map();

function clientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  return String(forwarded || req.ip || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
}

function allowed(ip) {
  const now = Date.now();
  const current = buckets.get(ip);
  if (!current || now - current.startedAt >= WINDOW_MS) {
    buckets.set(ip, { startedAt: now, count: 1 });
    return true;
  }
  if (current.count >= MAX_REQUESTS_PER_WINDOW) return false;
  current.count += 1;
  return true;
}

export async function chat(req, res, next) {
  const ip = clientIp(req);
  if (!allowed(ip)) {
    await writeAuditLog({
      actorId: req.user?._id ?? null,
      action: "AI_CHAT_RATE_LIMITED",
      resourceType: "AiAssistant",
      details: { method: req.method, path: req.originalUrl, ip },
      outcome: "FAILURE",
      statusCode: 429,
    });
    return sendResponse(res, 429, false, "Too many assistant requests. Please wait a minute and try again.", null, "AI_RATE_LIMITED");
  }

  try {
    const result = await chatWithFresh15({
      message: req.body?.message,
      history: req.body?.history,
      cart: req.body?.cart,
    });

    void writeAuditLog({
      actorId: req.user?._id ?? null,
      action: "AI_CHAT",
      resourceType: "AiAssistant",
      details: { method: req.method, path: req.originalUrl, ip, model: result.model },
      outcome: "SUCCESS",
      statusCode: 200,
    });

    return sendResponse(res, 200, true, "AI response generated", result, "OK");
  } catch (error) {
    void writeAuditLog({
      actorId: req.user?._id ?? null,
      action: "AI_CHAT_FAILED",
      resourceType: "AiAssistant",
      details: { method: req.method, path: req.originalUrl, ip, reason: error?.code || error?.message },
      outcome: "FAILURE",
      statusCode: error?.statusCode || 500,
    });
    return next(error);
  }
}
