import { ProductRepository } from "@repo/database";
import { CatalogService } from "./catalog.service.js";

async function main():Promise<void> {
  const productRepository = new ProductRepository();
  const catalogService = new CatalogService(productRepository);

  const products = await catalogService.listActiveProducts();

  console.log("Catalog service: OK");
  console.log("Active products:", products.length);
}

main().catch((error) =>{
  console.error("Catalog service check: FAILED");
  console.error(error);
  process.exitCode = 1;
});