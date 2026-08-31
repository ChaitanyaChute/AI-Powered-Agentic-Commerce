import { Worker } from "bullmq";
import { logger } from "./config/logger.js";
import { redisConnection } from "./config/redis.js";
import { processExampleJob } from "./processors/example.processor.js";

const worker = new Worker(
  "example",
  processExampleJob,
  {
    connection: redisConnection,
    concurrency: 5,
  },
);

worker.on("ready", () => {
  logger.info({concurrency: 5},
    "Worker ready",
  );
});

worker.on("completed", (job) => {
  logger.info(
    {
      jobId: job.id,
      jobName: job.name,
    },
    "Job completed",
  );
});

worker.on("failed", (job, error) => {
  logger.error(
    {
      jobId: job?.id,
      jobName: job?.name,
      err: error,
    },
    "Job failed",
  );
});

worker.on("error", (error) => {
  logger.error({err: error},
    "Worker error",
  );
});

async function shutdown(signal: string) {
  logger.info({signal},
    "Worker shutdown initiated",
  )
  await worker.close();
  logger.info("Worker shutdown complete");
  process.exit(0);
}

process.on("SIGTERM", () => { void shutdown("SIGTERM");});
process.on("SIGINT", () => { void shutdown("SIGINT");});