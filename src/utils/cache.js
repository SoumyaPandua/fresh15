import crypto from "node:crypto";
import redis from "../config/redis.js";

const localCache = new Map();
const LOCAL_MAX_ENTRIES = 256;
const REDIS_TIMEOUT_MS = 120;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const withTimeout = async (promise, fallback, timeoutMs = REDIS_TIMEOUT_MS) => {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((resolve) => {
        timer = setTimeout(() => resolve(fallback), timeoutMs);
      }),
    ]);
  } catch {
    return fallback;
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const clone = (value) => {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value));
};

const localGet = (key) => {
  const entry = localCache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    localCache.delete(key);
    return undefined;
  }
  return clone(entry.value);
};

const localSet = (key, value, ttlSeconds) => {
  if (localCache.size >= LOCAL_MAX_ENTRIES && !localCache.has(key)) {
    const oldestKey = localCache.keys().next().value;
    if (oldestKey) localCache.delete(oldestKey);
  }
  localCache.set(key, {
    value: clone(value),
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
};

const redisKey = (key) => `f15:cache:v1:${key}`;

export async function cacheGet(key) {
  const local = localGet(key);
  if (local !== undefined) return local;

  if (redis.status !== "ready") return undefined;
  const raw = await withTimeout(redis.get(redisKey(key)), null);
  if (!raw) return undefined;

  try {
    const value = JSON.parse(raw);
    localSet(key, value, 60);
    return value;
  } catch {
    return undefined;
  }
}

export async function cacheSet(key, value, ttlSeconds) {
  localSet(key, value, Math.min(ttlSeconds, 300));

  if (redis.status !== "ready") return value;
  const payload = JSON.stringify(value);
  await withTimeout(redis.set(redisKey(key), payload, "EX", ttlSeconds), null);
  return value;
}

export async function cacheDelete(key) {
  localCache.delete(key);
  await withTimeout(redis.del(redisKey(key)), 0);
}

export async function cacheDeleteByPrefix(prefix) {
  for (const key of localCache.keys()) {
    if (key.startsWith(prefix)) localCache.delete(key);
  }
  // Redis entries intentionally expire by TTL. Avoid SCAN/DEL on every admin write
  // so the cache stays within the monthly command budget.
}


export function stableCacheKey(prefix, input = {}) {
  const normalized = JSON.stringify(input, Object.keys(input).sort());
  const digest = crypto
    .createHash("sha1")
    .update(normalized)
    .digest("hex")
    .slice(0, 16);
  return `${prefix}:${digest}`;
}

export async function cached(key, ttlSeconds, loader) {
  const hit = await cacheGet(key);
  if (hit !== undefined) return hit;

  const value = await loader();
  if (value !== undefined && value !== null) {
    await cacheSet(key, value, ttlSeconds);
  }
  return value;
}

export const cacheSleep = sleep;
