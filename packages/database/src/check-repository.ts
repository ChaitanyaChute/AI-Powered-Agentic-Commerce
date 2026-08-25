import { CartItemRepository,CartRepository,disconnectDatabase,InventoryRepository,ProductRepository,CustomerRepository} from "./index.js";

async function main(): Promise<void> {
  const productRepository = new ProductRepository();
  const inventoryRepository = new InventoryRepository();
  const customerRepository = new CustomerRepository();
  const cartRepository = new CartRepository();
  const cartItemRepository = new CartItemRepository();

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

  const customer = await customerRepository.findByEmail("smoke-test@example.com");

  const cart = await cartRepository.findActiveByCustomerId("00000000-0000-0000-0000-000000000000");

  const cartItem = await cartItemRepository.findByCartAndProduct(
  "00000000-0000-0000-0000-000000000000",
  "00000000-0000-0000-0000-000000000000",);

  console.log(
    "Cart item repository: OK",
     cartItem ? "item found" : "no item",
  );

  console.log(
   "Cart repository: OK",
   cart ? "active cart found" : "no active cart",
  );

console.log(
  "Customer repository:OK",
  customer ?"customer found":"no customer",
);
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