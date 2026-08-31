import {env} from "./config/env.js";
import { createApp } from "./app.js";
import { logger } from "./lib/logger.js";
import { closeInfra } from "./config/lifecycle.js";

const app = createApp();

const server =  app.listen(env.API_PORT,env.API_HOST, () =>{
    logger.info({
        host:env.API_HOST,
        port:env.API_PORT,
    },
    "API server started",
);
});

let isShutdown = false;

function shutdown(signal:string){
    logger.info({
        signal,
    },
    "shutdown signal received",
    );
    
    server.close(async(error)=>{
        if(error){
            logger.error({
                err:error,
            },
            "Error during shutting HTTP server"
            )
        }

        try{
            await closeInfra();
            logger.info("API server shutdown completed");
            process.exit(error ? 1 :0);
        }catch(shutdownError){
            logger.fatal(
                {
                    err: shutdownError,
                },
                "Fatal error during shutting down",
            )
            process.exit(1);
        }
    });
}

process.on("SIGTERM",()=>void shutdown("SIGTERM"));
process.on("SIGINT",()=> void shutdown("SIGINT"));
