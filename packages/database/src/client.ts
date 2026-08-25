import { PrismaClient } from "@prisma/client";
import { databaseEnv } from "./env.js";

process.env.DATABASE_URL = databaseEnv.DATABASE_URL;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =globalForPrisma.prisma ??new PrismaClient();

if (process.env.NODE_ENV !== "production") {
   globalForPrisma.prisma = prisma;
  }

export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}

export async function checkDatabaseConnection(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
}