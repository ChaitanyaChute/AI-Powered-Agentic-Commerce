import type { Job } from "bullmq";
import { logger } from "../config/logger.js";

export async function processExampleJob(job: Job){
  logger.info(
    {
      jobId: job.id,
      jobName: job.name,
      data: job.data,
    },
    "Processing example job",
  );

  return {
    processed: true,
  };
}