import {createExampleQueue} from "@repo/queues";
import { redisConnection } from "../config/redis.js";

export const exampleQueue = createExampleQueue(
    redisConnection
);