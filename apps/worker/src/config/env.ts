import dotenv from "dotenv";
import {z} from "zod";
import path from "path";

dotenv.config({
  path: path.resolve(process.cwd(), "../../.env"),
});

const envSchema = z.object({
    NODE_ENV:z.enum(["development","test","production"]).default("development"),

    REDIS_URL : z.string().min(1),

    LOG_LEVEL : z.enum(["info","fatal","error","warn","trace","debug"]).default("info") 
});

const env_parsed = envSchema.safeParse(process.env)

if(!env_parsed.success){
    console.error({
        "error":"Invalid worker environment."
    })

    console.error(z.prettifyError(env_parsed.error))
    process.exit(1)
}

export const env = env_parsed.data;
