import { Queue } from "bullmq";
import type { RedisConnectionConfig } from "./connection.js";

export function createExampleQueue(
  connection: RedisConnectionConfig,
): Queue {
  return new Queue("example", {
    connection,
  });
}