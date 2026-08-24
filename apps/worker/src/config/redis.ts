import {URL} from "node:url";
import {env} from "./env.js";

const redisUrl = new URL(env.REDIS_URL);

export const redisConnection = {
    host:redisUrl.hostname,
    port: Number(redisUrl.port) || 6379,
    ...(redisUrl.password ?{password:redisUrl.password}:{}),
    ...(redisUrl.username ?{username:redisUrl.username}:{}),
}