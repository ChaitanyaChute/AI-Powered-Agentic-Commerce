import { CartItemRepository,CartRepository,ProductRepository} from "@repo/database";
import { CartService } from "./cart.service.js";

async function main(): Promise<void> {
  const cartService = new CartService(
    new CartRepository(),
    new CartItemRepository(),
    new ProductRepository(),
  );

  const cart =await cartService.getActiveCart("00000000-0000-0000-0000-000000000000");

  console.log("Cart service: OK");
  console.log(
    "Active cart:",
    cart ? cart.id : "none",
  );
}

main().catch((error) => {
  console.error("Cart service check: FAILED");
  console.error(error);
  process.exitCode = 1;
});