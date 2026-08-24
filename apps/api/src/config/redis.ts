import {Redis} from "ioredis";
import { env } from "./env.js";
import {logger} from "../lib/logger.js";

const redisUrl = new URL(env.REDIS_URL);

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
});

export const redisConnection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port) || 6379,
  ...(new URL(env.REDIS_URL).username?{username: new URL(env.REDIS_URL).username}:{}),
  ...(new URL(env.REDIS_URL).password?{password: new URL(env.REDIS_URL).password}:{}),
};

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