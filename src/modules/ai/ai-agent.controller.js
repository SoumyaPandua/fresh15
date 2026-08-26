import sendResponse from "../../utils/sendResponse.js";
import { agent, confirmAgentAction, declineAgentAction } from "./ai-agent.service.js";

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
  if (!entry || now - entry.startedAt >= WINDOW) {
    buckets.set(ip, { startedAt: now, count: 1 });
    return true;
  }
  if (entry.count >= LIMIT) return false;
  entry.count += 1;
  return true;
}

export async function postAgent(req, res, next) {
  try {
    if (!allowed(req)) {
      return res.status(429).json({
        success: false,
        message: "Too many AI agent requests. Please try again in a minute.",
        code: "AI_AGENT_RATE_LIMIT",
        data: null,
        errors: [],
      });
    }

    const data = await agent({
      user: req.user,
      message: req.body?.message,
      conversationId: req.body?.conversationId,
      req,
    });

    return sendResponse(res, 200, true, "AI agent completed", data);
  } catch (error) {
    return next(error);
  }
}

export async function confirmAgent(req, res, next) {
  try {
    if (!allowed(req)) {
      return res.status(429).json({
        success: false,
        message: "Too many AI agent requests. Please try again in a minute.",
        code: "AI_AGENT_RATE_LIMIT",
        data: null,
        errors: [],
      });
    }

    const data = await confirmAgentAction({
      user: req.user,
      conversationId: req.body?.conversationId,
      confirmationId: req.body?.confirmationId,
      req,
    });

    return sendResponse(res, 200, true, "AI agent action confirmed", data);
  } catch (error) {
    return next(error);
  }
}

export async function declineAgent(req, res, next) {
  try {
    if (!allowed(req)) {
      return res.status(429).json({
        success: false,
        message: "Too many AI agent requests. Please try again in a minute.",
        code: "AI_AGENT_RATE_LIMIT",
        data: null,
        errors: [],
      });
    }

    const data = await declineAgentAction({
      user: req.user,
      conversationId: req.body?.conversationId,
      confirmationId: req.body?.confirmationId,
      req,
    });

    return sendResponse(res, 200, true, "AI agent action cancelled", data);
  } catch (error) {
    return next(error);
  }
}
