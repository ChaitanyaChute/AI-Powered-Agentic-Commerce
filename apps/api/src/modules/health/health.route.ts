import { checkDatabase } from "../../config/database.js";
import { checkRedis } from "../../config/redis.js";
import {Router} from "express"

const router:Router = Router();

router.get("/health",(req,res)=>{
    return res.status(200).json({
        status:"ok"
    })
})

router.get("/ready",async(req,res)=>{
    const [dbResult,redisResult] = await Promise.allSettled([
        checkDatabase(),
        checkRedis(),
    ])

    const database = dbResult.status === "fulfilled" && dbResult.value === true;
    const redis = redisResult.status === "fulfilled" && redisResult.value === true;

    const ready = database && redis;

    return res.status(ready ? 200 : 503).json({
        status: ready ? "ready" : "not_Ready",
        dependencies : {
            database,
            redis
        }
    })
})

export default router;