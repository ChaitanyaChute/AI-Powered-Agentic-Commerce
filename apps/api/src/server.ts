import {env} from "./config/env.js";
import { createApp } from "./app.js";
import { logger } from "./lib/logger.js";

const app = createApp();

const server =  app.listen(env.API_PORT,env.API_HOST, () =>{
    logger.info({
        host:env.API_HOST,
        port:env.API_PORT,
    },
    "API server started",
);
});
