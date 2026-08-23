import dotenv from "dotenv";
import { createApp } from "./app.js";

dotenv.config();

const PORT = Number(process.env.API_PORT ?? 4000);
const HOST = process.env.API_HOST ?? "0.0.0.0";

const app = createApp();

const server =  app.listen(PORT,HOST, () =>{
    console.log(`API server is running on ${HOST}:${PORT}`);
    
});
