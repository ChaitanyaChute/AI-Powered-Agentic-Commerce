import pino, { stdTimeFunctions } from "pino";
import { env } from "../config/env.js";

export const logger = pino({
    level : env.LOG_LEVEL,

    base:{
        service:"api",
    },

    timestamp: pino.stdTimeFunctions.isoTime,

    ...(env.NODE_ENV === "development"?
    {
        transport:{
            target:"pino-pretty",
            options:{
                colorize: true,
                translatetime:"SYS:standard",
                singleLine:true
            }
        }
    }:{}),


})