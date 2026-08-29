import { Router } from "express";
import { redis } from "../../config/redis.js";
import { IdempotencyService } from "../../lib/idempotency/idempotency.service.js";

const router:Router= Router();
const idempotencyService =new IdempotencyService(redis);

router.post("/internal/idempotency/test",async(req,res,next)=>{
    try {
      const idempotencyKey =req.header("Idempotency-Key");

      if (!idempotencyKey){
        return res.status(400).json({
          error: {
            code:"MISSING_IDEMPOTENCY_KEY",
            message:"Idempotency-Key header is required.",
          },
        });
      }

      const requestHash = "internal-test-request";

const acquired =
  await idempotencyService.acquire(
    "test",
    idempotencyKey,
    requestHash,
  );

      if (!acquired){
        const existing =await idempotencyService.get(
            "test",
            idempotencyKey,
          );

        return res.status(200).json({
          status: "duplicate",
          existing,
        });
      }

      const response= {
        message: "Operation acquired successfully.",
      };

      await idempotencyService.complete(
  "test",
  idempotencyKey,
  requestHash,
  response,
);

      return res.status(200).json({
        status: "completed",
        response,
      });
    } catch(error) {
      return next(error);
    }
  },
);

export default router;