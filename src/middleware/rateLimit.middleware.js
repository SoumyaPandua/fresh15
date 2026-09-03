import crypto from "node:crypto";
import redis from "../config/redis.js";
import AppError from "../utils/AppError.js";

const hash = (value) => crypto.createHash("sha256").update(String(value || "")).digest("hex");

const hit = async (key, windowSeconds) => {
  const count = Number(await redis.incr(key));
  if (count === 1) await redis.expire(key, windowSeconds);
  return count;
};

const limitResponse = (res, max, count, windowSeconds) => {
  res.set("Retry-After", String(windowSeconds));
  res.set("X-RateLimit-Limit", String(max));
  res.set("X-RateLimit-Remaining", String(Math.max(0, max - count)));
};

export const redisRateLimit = ({ name = "api", max = 300, windowSeconds = 60, keyFn = (req) => req.ip } = {}) =>
  async (req, res, next) => {
    try {
      const count = await hit(`rate:${name}:${hash(keyFn(req))}`, windowSeconds);
      if (count > max) {
        limitResponse(res, max, count, windowSeconds);
        throw new AppError(429, "RATE_LIMITED", "Too many requests. Please try again later.");
      }
      res.set("X-RateLimit-Limit", String(max));
      res.set("X-RateLimit-Remaining", String(Math.max(0, max - count)));
      return next();
    } catch (error) {
      return next(error);
    }
  };

export const redisDualRateLimit = ({ name, max = 10, windowSeconds = 60, accountKeyFn } = {}) =>
  async (req, res, next) => {
    try {
      const ipCount = await hit(`rate:${name}:ip:${hash(req.ip)}`, windowSeconds);
      const account = accountKeyFn?.(req);
      const accountCount = account
        ? await hit(`rate:${name}:account:${hash(account)}`, windowSeconds)
        : 0;

      if (ipCount > max || accountCount > max) {
        limitResponse(res, max, Math.max(ipCount, accountCount), windowSeconds);
        throw new AppError(429, "RATE_LIMITED", "Too many requests. Please try again later.");
      }

      const used = Math.max(ipCount, accountCount);
      res.set("X-RateLimit-Limit", String(max));
      res.set("X-RateLimit-Remaining", String(Math.max(0, max - used)));
      return next();
    } catch (error) {
      return next(error);
    }
  };

export const redisActionRateLimit = ({ name, max, windowSeconds = 60, accountKeyFn = (req) => req.user?._id } = {}) =>
  redisDualRateLimit({ name, max, windowSeconds, accountKeyFn });
