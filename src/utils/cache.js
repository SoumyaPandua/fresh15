import crypto from "node:crypto";
import redis from "../config/redis.js";

const localCache = new Map();
const LOCAL_MAX_ENTRIES = 256;
const REDIS_TIMEOUT_MS = 250;

const withTimeout = async (promise, fallback, timeoutMs = REDIS_TIMEOUT_MS) => {
  let timer;
  try {
    return await Promise.race([promise, new Promise((resolve) => { timer = setTimeout(() => resolve(fallback), timeoutMs); })]);
  } catch { return fallback; }
  finally { if (timer) clearTimeout(timer); }
};

const clone = (value) => value === undefined || value === null ? value : JSON.parse(JSON.stringify(value));
const localGet = (key) => {
  const entry = localCache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) { localCache.delete(key); return undefined; }
  return clone(entry.value);
};
const localSet = (key, value, ttlSeconds) => {
  if (localCache.size >= LOCAL_MAX_ENTRIES && !localCache.has(key)) {
    const oldestKey = localCache.keys().next().value;
    if (oldestKey) localCache.delete(oldestKey);
  }
  localCache.set(key, { value: clone(value), expiresAt: Date.now() + Math.max(1, Math.min(Number(ttlSeconds) || 1, 300)) * 1000 });
};
const redisKey = (key) => `f15:cache:v2:${key}`;

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
  } catch { return undefined; }
}

export async function cacheSet(key, value, ttlSeconds) {
  localSet(key, value, ttlSeconds);
  if (redis.status !== "ready") return value;
  await withTimeout(redis.set(redisKey(key), JSON.stringify(value), "EX", Math.max(1, Number(ttlSeconds) || 1)), null);
  return value;
}

export async function cacheDelete(key) {
  localCache.delete(key);
  await withTimeout(redis.del(redisKey(key)), 0);
}

export async function cacheDeleteByPrefix(prefix) {
  for (const key of localCache.keys()) if (key.startsWith(prefix)) localCache.delete(key);
  if (redis.status !== "ready") return;
  let cursor = "0";
  do {
    const [next, keys] = await withTimeout(redis.scan(cursor, "MATCH", `${redisKey(prefix)}*`, "COUNT", 100), [cursor, []], 500);
    cursor = next;
    if (keys.length) await withTimeout(redis.del(...keys), 0, 500);
  } while (cursor !== "0");
}

export function stableCacheKey(prefix, input = {}) {
  const normalized = JSON.stringify(input, Object.keys(input).sort());
  return `${prefix}:${crypto.createHash("sha1").update(normalized).digest("hex").slice(0, 16)}`;
}

export async function cached(key, ttlSeconds, loader) {
  const hit = await cacheGet(key);
  if (hit !== undefined) return hit;
  const value = await loader();
  if (value !== undefined && value !== null) await cacheSet(key, value, ttlSeconds);
  return value;
}
