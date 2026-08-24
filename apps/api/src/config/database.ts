import { prisma } from "@repo/database";

export async function checkDatabase(): Promise<boolean> {
  await prisma.$queryRaw`SELECT 1`;

  return true;
}