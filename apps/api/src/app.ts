import express, {type Express} from "express";
import cors from "cors";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { logger} from "./lib/logger.js";
import {requestId} from "./middleware/request-id.js";
import {errorHandler} from "./middleware/error-handler.js";
import { healthRoutes } from "./modules/health/index.js";
import jobsRoutes from "./modules/jobs/jobs.routes.js";


export const createApp = ():Express =>{
    const app = express();

    app.use(helmet());

    app.use(
        cors({
            origin: true,
            credentials: true
        }),
    );

    app.use(express.json({limit:"1mb"}));

    app.use(express.urlencoded(
        {
            extended:true,
            limit:"1mb"
        }
    ))

    app.use(requestId)

    app.use(
        pinoHttp({
            logger,

            redact:{
                paths:[
                    "req.headers.authorization",
                    "req.headers.cookie",
                    "req.headers.x-api-key",
                    "res.headers.set-cookie",
                ],
                censor:"[REDACTED]",
            },

                customLogLevel:(req,res, err)=>{
                    if(err || res.statusCode >= 500){
                        return "error";
                    }
                    if(res.statusCode >= 400){
                        return "warn";
                    }

                    return "info";
                }
        })
    );
    
    app.use(healthRoutes);
    app.use(jobsRoutes);

    app.use(errorHandler)

    return app;
}