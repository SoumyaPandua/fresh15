import { getRequestContext } from "./request-context.middleware.js";

const MAX_ENDPOINTS = 1000;
const endpoints = new Map();
const counters = {
  requests: 0,
  errors: 0,
  status2xx: 0,
  status4xx: 0,
  status5xx: 0,
};

const percentile = (values, p) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)];
};

const routeKey = (req) => {
  const route = req.route?.path;
  return `${req.method} ${route ? `${req.baseUrl || ""}${route}` : (req.path || "/")}`;
};

const getEntry = (key) => {
  let entry = endpoints.get(key);
  if (!entry) {
    if (endpoints.size >= MAX_ENDPOINTS) {
      endpoints.delete(endpoints.keys().next().value);
    }
    entry = { count: 0, errors: 0, durations: [], status: {} };
    endpoints.set(key, entry);
  }
  return entry;
};

export default function metricsMiddleware(req, res, next) {
  const started = process.hrtime.bigint();
  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
    const status = res.statusCode;
    const key = routeKey(req);
    const entry = getEntry(key);
    entry.count += 1;
    entry.errors += status >= 500 ? 1 : 0;
    entry.durations.push(durationMs);
    if (entry.durations.length > 200) entry.durations.shift();
    entry.status[status] = (entry.status[status] || 0) + 1;

    counters.requests += 1;
    if (status >= 500) { counters.errors += 1; counters.status5xx += 1; }
    else if (status >= 400) counters.status4xx += 1;
    else counters.status2xx += 1;

    const context = getRequestContext();
    console.log(JSON.stringify({
      event: "http.request",
      requestId: context?.requestId || req.requestId || null,
      traceId: context?.traceId || req.traceId || null,
      spanId: context?.spanId || req.spanId || null,
      method: req.method,
      path: req.path,
      statusCode: status,
      durationMs: Number(durationMs.toFixed(2)),
    }));
  });
  next();
}

export const getMetricsSnapshot = () => ({
  counters: { ...counters },
  endpoints: Object.fromEntries([...endpoints.entries()].map(([key, entry]) => [
    key,
    {
      count: entry.count,
      errors: entry.errors,
      errorRate: entry.count ? Number((entry.errors / entry.count).toFixed(4)) : 0,
      p95Ms: Number(percentile(entry.durations, 95).toFixed(2)),
      p99Ms: Number(percentile(entry.durations, 99).toFixed(2)),
      status: { ...entry.status },
    },
  ])),
});
