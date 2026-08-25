import {CartRepository,CustomerRepository,InventoryRepository,OrderItemRepository,OrderRepository,ProductRepository} from "@repo/database";
import { OrderService } from "./order.service.js";

async function main(): Promise<void> {
  const orderService = new OrderService(
  new CartRepository(),
  new CustomerRepository(),
  new OrderRepository(),
  new OrderItemRepository(),
  new ProductRepository(),
  new InventoryRepository(),
);

  const order = await orderService.getOrderByNumber(
    "SMOKE-TEST-ORDER",
  );

  console.log("Order service: OK");
  console.log(
    "Order:",
    order ? order.id : "none",
  );
}

main().catch((error) => {
  console.error("Order service check: FAILED");
  console.error(error);
  process.exitCode = 1;
});