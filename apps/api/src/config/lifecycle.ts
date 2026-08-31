import { prisma } from "@repo/database"; 
import { redis } from "./redis.js";
import {logger} from "../lib/logger.js"

export async function closeInfra() {
    logger.info("Closing infra connections")

    await Promise.allSettled([
        prisma.$disconnect(),
        redis.quit()
    ])

    logger.info("Infra connections closed sucessfully.")

}

