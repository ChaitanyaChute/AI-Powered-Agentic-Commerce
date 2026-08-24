import {Redis} from "ioredis";
import { env } from "./env.js";
import {logger} from "../lib/logger.js";

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
});

redis.on("error", (error) => {
  logger.error({err:error}, "Redis connection error");
});

redis.on("connect", () => {
  logger.info("Redis connection established");
});

redis.on("ready", () => {
  logger.info("Redis client ready");
});

redis.on("close", () => {
  logger.warn("Redis connection closed");
});

export async function checkRedis(): Promise<boolean> {
  const result = await redis.ping();

  return result === "PONG";
}