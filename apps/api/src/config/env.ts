import dotenv from "dotenv";
import {z} from "zod";
import path from "path";

dotenv.config({
  path: path.resolve(process.cwd(), "../../.env"),
});

const envSchema = z.object({
    NODE_ENV:z.enum(["development","test","production"]).default("development"),

    API_HOST:z.string().default("0.0.0.0"),

    API_PORT:z.coerce.number()
                .int()
                .min(1)
                .max(65535)
                .default(4000),

    DATABASE_URL: z.string().min(1),

    REDIS_URL : z.string().min(1),

    RAZORPAY_KEY_ID : z.string().optional(),

    RAZORPAY_KEY_SECRET : z.string().optional(),

    RAZORPAY_WEBHOOK_SECRET : z.string().optional(),

    LLM_API_KEY : z.string().optional(),

    LLM_MODEL : z.string().optional(),

    LOG_LEVEL : z.enum(["info","fatal","error","warn","trace","debug"]).default("info") 
});

const env_parsed = envSchema.safeParse(process.env)

if(!env_parsed.success){
    console.error({
        "error":"Invalid environment configuration."
    })

    console.error(z.prettifyError(env_parsed.error))
    process.exit(1)
}

export const env = env_parsed.data;
