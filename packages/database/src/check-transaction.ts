import {disconnectDatabase,withDatabaseTransaction,} from "./client.js";

async function main(): Promise<void> {
  try {
    const result = await withDatabaseTransaction(async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{ result: number }>
      >`SELECT 1 AS result`;

      return rows[0]?.result;
    });

    console.log("Database transaction: OK");
    console.log("Transaction result:", result);
  } catch (error) {
    console.error("Database transaction: FAILED");
    console.error(error);
    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
  }
}

void main();