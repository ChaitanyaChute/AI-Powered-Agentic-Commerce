import {disconnectDatabase,ProductRepository} from "./index.js"

async function main(): Promise<void> {
  const productRepository = new ProductRepository();

  const products = await productRepository.listActive();

  console.log("Product repository: OK");
  console.log("Active products:", products.length);
}

main()
  .catch((error) => {
    console.error("Product repository check: FAILED");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });