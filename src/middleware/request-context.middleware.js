import crypto from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";

export const requestContext = new AsyncLocalStorage();

const ID_RE = /^[A-Za-z0-9._:-]{1,128}$/;
const HEX_RE = /^[0-9a-f]{16,64}$/i;

const normalizeId = (value) => {
  const input = String(value || "").trim();
  return ID_RE.test(input) ? input : crypto.randomUUID();
};

const normalizeTraceId = (value) => {
  const input = String(value || "").trim();
  return HEX_RE.test(input) ? input.slice(0, 32).padStart(32, "0") : crypto.randomBytes(16).toString("hex");
};

const normalizeSpanId = (value) => {
  const input = String(value || "").trim();
  return HEX_RE.test(input) ? input.slice(0, 16).padStart(16, "0") : crypto.randomBytes(8).toString("hex");
};

const parseTraceparent = (value) => {
  const match = String(value || "").trim().match(/^[\da-f]{2}-([\da-f]{32})-([\da-f]{16})-[\da-f]{2}$/i);
  if (!match) return null;
  return { traceId: match[1].toLowerCase(), parentSpanId: match[2].toLowerCase() };
};

export default function requestContextMiddleware(req, res, next) {
  const trace = parseTraceparent(req.get("traceparent"));
  const requestId = normalizeId(req.get("x-request-id"));
  const traceId = trace?.traceId || normalizeTraceId(req.get("x-trace-id"));
  const spanId = normalizeSpanId();
  const startedAt = process.hrtime.bigint();

  const context = {
    requestId,
    traceId,
    spanId,
    parentSpanId: trace?.parentSpanId || null,
    startedAt,
    req,
  };

  req.requestId = requestId;
  req.traceId = traceId;
  req.spanId = spanId;

  res.setHeader("X-Request-Id", requestId);
  res.setHeader("X-Trace-Id", traceId);
  res.setHeader("X-Span-Id", spanId);

  requestContext.run(context, () => next());
}
export const getRequestContext = () => requestContext.getStore();
