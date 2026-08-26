import sendResponse from "../../utils/sendResponse.js";
import { agent } from "./ai-agent.service.js";

const WINDOW = 60_000;
const LIMIT = 8;
const buckets = new Map();

const ipOf = (req) => {
  const x = req.headers["x-forwarded-for"];
  return typeof x === "string" && x ? x.split(",")[0].trim() : req.ip || req.socket?.remoteAddress || "unknown";
};

function allowed(req) {
  const ip = ipOf(req);
  const now = Date.now();
  const entry = buckets.get(ip);
  if (!entry || now - entry.startedAt >= WINDOW) { buckets.set(ip, { startedAt: now, count: 1 }); return true; }
  if (entry.count >= LIMIT) return false;
  entry.count += 1;
  return true;
}

export async function postAgent(req, res, next) {
  try {
    if (!allowed(req)) return res.status(429).json({ success: false, message: "Too many AI agent requests. Please try again in a minute.", code: "AI_AGENT_RATE_LIMIT", data: null, errors: [] });
    return sendResponse(res, 200, true, "AI agent completed", await agent({ user: req.user, message: req.body?.message, req }));
  } catch (error) { return next(error); }
}
