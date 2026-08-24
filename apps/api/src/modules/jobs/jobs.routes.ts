import { Router } from "express";
import { redisConnection } from "../../config/redis.js";
import { JobsService } from "./jobs.service.js";

const router:Router = Router();

const jobsService = new JobsService(redisConnection);

router.post("/internal/jobs/example", async (req, res, next) => {
  try {
    const message =
      typeof req.body?.message === "string" &&
      req.body.message.trim().length > 0 ? req.body.message.trim(): "Hello from API";

    const result =await jobsService.enqueueExampleJob(message);

    return res.status(202).json({
      status: "queued",
      jobId: result.jobId,
    });
  }catch(error) {
    return next(error);
  }
});

export default router;