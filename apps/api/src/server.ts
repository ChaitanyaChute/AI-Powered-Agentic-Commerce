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

function shutdown(signal:string){
    logger.info({
        signal,
    },
    "shutdown signal received",
    );
    
    server.close((error)=>{
        if(error){
            logger.error({
                err:error,
            },
            "Error during shutting down server"
            )
            process.exit(1);
        }
        logger.info("API server stopped");
        process.exit(0);
    });
}

process.on("SIGTERM",()=>shutdown("SIGTERM"));
process.on("SIGINT",()=>shutdown("SIGINT"));
