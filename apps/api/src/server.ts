import {env} from "./config/env.js";
import { createApp } from "./app.js";

const app = createApp();

const server =  app.listen(env.API_PORT,env.API_HOST, () =>{
    console.log(`API server is running on ${env.API_HOST}:${env.API_PORT}`);
    
});
