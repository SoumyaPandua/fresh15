import crypto from "node:crypto";
import redis from "../config/redis.js";
import AppError from "../utils/AppError.js";

const hash = (value) => crypto.createHash("sha256").update(String(value || "")).digest("hex");

const hit = async (key, windowSeconds) => {
  const count = Number(await redis.incr(key));
  if (count === 1) await redis.expire(key, windowSeconds);
  return count;
};

export const redisRateLimit = ({ name = "api", max = 300, windowSeconds = 60, keyFn = (req) => req.ip } = {}) =>
  async (req, res, next) => {
    try {
      if (await hit(`rate:${name}:${hash(keyFn(req))}`, windowSeconds) > max) {
        res.set("Retry-After", String(windowSeconds));
        throw new AppError(429, "RATE_LIMITED", "Too many requests. Please try again later.");
      }
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
        res.set("Retry-After", String(windowSeconds));
        throw new AppError(429, "RATE_LIMITED", "Too many requests. Please try again later.");
      }
      return next();
    } catch (error) {
      return next(error);
    }
  };
