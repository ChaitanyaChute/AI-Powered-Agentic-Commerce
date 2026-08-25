import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);

dotenv.config({path: path.resolve(currentDir, "../../../.env")});

const envSchema = z.object({DATABASE_URL: z.string().min(1)});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid database environment configuration.");
  console.error(z.prettifyError(parsed.error));
  process.exit(1);
}

export const databaseEnv = parsed.data;