import {checkDatabaseConnection,disconnectDatabase,} from "./client.js";

async function main(): Promise<void> {
  await checkDatabaseConnection();
  console.log("Database connection: OK");
}

main()
  .catch((error) => {
    console.error("Database connection: FAILED");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {await disconnectDatabase();
  });