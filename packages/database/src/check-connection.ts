import {checkDatabaseConnection,disconnectDatabase,ProductRepository,} from "./index.js";

async function main(): Promise<void> {
  await checkDatabaseConnection();

  const productRepository = new ProductRepository();
  const products = await productRepository.listActive();

  console.log("Database connection: OK");
  console.log("Active products:", products.length);
}

main()
  .catch((error) => {
    console.error("Database/repository check: FAILED");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });