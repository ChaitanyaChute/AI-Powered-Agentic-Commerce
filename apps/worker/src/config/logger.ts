import pino, { transport } from "pino";
import {env} from "./env.js";

export const logger = pino({
    level: env.LOG_LEVEL,

    base:{
        service:"worker",
    },

    timestamp: pino.stdTimeFunctions.isoTime,

    ...(env.NODE_ENV === "development" ?{
        transport:{
            target:"pino-pretty",
            options:{
                colorize:true,
                translateTime:"SYS:standard",
                singleLine : true,
            }
        }
    }:{})
})
