import {disconnectDatabase,InventoryRepository,ProductRepository,} from "./index.js";

async function main(): Promise<void> {
  const productRepository = new ProductRepository();
  const inventoryRepository = new InventoryRepository();

  const products = await productRepository.listActive();

  console.log("Product repository: OK");
  console.log("Active products:", products.length);

  const firstProduct = products[0];

if (firstProduct) {
  const inventory = await inventoryRepository.findByProductId(
    firstProduct.id,
  );

  console.log(
    "Inventory repository: OK",
    inventory ? "inventory found" : "no inventory",
  );
  } else {
    console.log(
    "Inventory repository: READY (no products to test against)",
  );
  }
}

main()
  .catch((error) => {
    console.error("Repository check: FAILED");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
});