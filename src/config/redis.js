import Redis from "ioredis";
import { UPSTASH_REDIS_URL } from "./env.js";

const redis = new Redis(UPSTASH_REDIS_URL);

redis.on("connect", () => {
    console.log("Redis Connected");
});

redis.on("error", (error) => {
    console.error("Redis Error:", error.message);
});

export default redis;