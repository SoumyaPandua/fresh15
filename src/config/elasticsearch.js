/*
 * Elasticsearch is optional. Configure:
 *   ELASTICSEARCH_URL=https://your-cluster.example.com
 *   ELASTICSEARCH_API_KEY=<base64-encoded-api-key>   (preferred)
 *   ELASTICSEARCH_USERNAME=...                       (alternative)
 *   ELASTICSEARCH_PASSWORD=...
 *   ELASTICSEARCH_INDEX=fresh15-products
 *   ELASTICSEARCH_TIMEOUT_MS=2500
 *
 * Uses Node's built-in fetch, so no Elasticsearch npm package is required.
 * When Elasticsearch is missing/down, callers can safely fall back to MongoDB.
 */
import "./env.js";

const DEFAULT_TIMEOUT_MS = 2500;
const DEFAULT_INDEX = "fresh15-products";

const cleanBaseUrl = (value) => String(value || "").trim().replace(/\/+$/, "");
const timeoutMs = () => {
  const value = Number(process.env.ELASTICSEARCH_TIMEOUT_MS);
  return Number.isFinite(value) && value >= 250 ? value : DEFAULT_TIMEOUT_MS;
};

export const elasticsearchConfig = {
  url: cleanBaseUrl(process.env.ELASTICSEARCH_URL),
  apiKey: String(process.env.ELASTICSEARCH_API_KEY || "").trim(),
  username: String(process.env.ELASTICSEARCH_USERNAME || "").trim(),
  password: String(process.env.ELASTICSEARCH_PASSWORD || "").trim(),
  index: String(process.env.ELASTICSEARCH_INDEX || DEFAULT_INDEX).trim() || DEFAULT_INDEX,
  timeoutMs,
};

export const isElasticsearchConfigured = () => Boolean(elasticsearchConfig.url);

const authHeaders = () => {
  if (elasticsearchConfig.apiKey) {
    return { Authorization: `ApiKey ${elasticsearchConfig.apiKey}` };
  }

  if (elasticsearchConfig.username || elasticsearchConfig.password) {
    const value = Buffer.from(
      `${elasticsearchConfig.username}:${elasticsearchConfig.password}`,
      "utf8",
    ).toString("base64");

    return { Authorization: `Basic ${value}` };
  }

  return {};
};

export const elasticsearchRequest = async (path, options = {}) => {
  if (!isElasticsearchConfigured()) {
    const error = new Error("Elasticsearch is not configured");
    error.code = "ELASTICSEARCH_NOT_CONFIGURED";
    throw error;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), elasticsearchConfig.timeoutMs());
  timer.unref?.();

  try {
    const response = await fetch(`${elasticsearchConfig.url}${path}`, {
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...authHeaders(),
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });

    const raw = await response.text();
    let body = null;

    if (raw) {
      try {
        body = JSON.parse(raw);
      } catch {
        body = raw;
      }
    }

    if (!response.ok) {
      const error = new Error(
        body?.error?.reason ||
          body?.message ||
          `Elasticsearch request failed with status ${response.status}`,
      );
      error.code = `ELASTICSEARCH_HTTP_${response.status}`;
      error.status = response.status;
      error.details = body;
      throw error;
    }

    return body;
  } finally {
    clearTimeout(timer);
  }
};
