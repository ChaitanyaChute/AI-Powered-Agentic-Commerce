import {CartRepository,CustomerRepository,InventoryRepository, OrderItemRepository,OrderRepository,ProductRepository,prisma} from "@repo/database";
import { OrderService } from "./order.service.js";

async function main(): Promise<void> {
  let customerId: string | undefined;
  let productId: string | undefined;
  let cartId: string | undefined;

  try {
    const customerRepository = new CustomerRepository();
    const productRepository = new ProductRepository();
    const inventoryRepository = new InventoryRepository();
    const cartRepository = new CartRepository();
    const orderRepository = new OrderRepository();
    const orderItemRepository = new OrderItemRepository();

    const orderService = new OrderService(
      cartRepository,
      customerRepository,
      orderRepository,
      orderItemRepository,
      productRepository,
      inventoryRepository,
    );

    const suffix = Date.now();

    const customer = await customerRepository.create({
      email: `rollback-smoke-${suffix}@example.com`,
      name: "Rollback Smoke Customer",
    });

    customerId = customer.id;

    const product = await productRepository.create({
      sku: `ROLLBACK-SMOKE-${suffix}`,
      name: "Rollback Smoke Product",
      description: "Temporary rollback test product",
      priceMinor: 1000,
      currency: "INR",
      active: true,
    });

    productId = product.id;

    await inventoryRepository.create(
      product.id,
      10,
    );

    const cart = await cartRepository.create({
      customer: {
        connect: {
          id: customer.id,
        },
      },
    });

    cartId = cart.id;

    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId: product.id,
        quantity: 11,
      },
    });

    try {
      await orderService.createOrderFromCart(
        customer.id,
        cart.id,
      );

      throw new Error(
        "Expected checkout to fail due to insufficient inventory.",
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message ===
          "Expected checkout to fail due to insufficient inventory."
      ) {
        throw error;
      }

      console.log(
        "Checkout correctly rejected:",
        error instanceof Error
          ? error.message
          : error,
      );
    }

    const currentCart =
      await cartRepository.findById(cart.id);

    if (!currentCart) {
      throw new Error(
        "Cart disappeared after rollback.",
      );
    }

    if (currentCart.status !== "ACTIVE") {
      throw new Error(
        `Expected cart ACTIVE, got ${currentCart.status}.`,
      );
    }

    const inventory =
      await inventoryRepository.findByProductId(
        product.id,
      );

    if (!inventory) {
      throw new Error(
        "Inventory disappeared after rollback.",
      );
    }

    if (inventory.reserved !== 0) {
      throw new Error(
        `Expected reserved 0, got ${inventory.reserved}.`,
      );
    }

    const orders =
      await orderRepository.listByCustomerId(
        customer.id,
      );

    if (orders.length !== 0) {
      throw new Error(
        `Expected no orders, found ${orders.length}.`,
      );
    }

    console.log(
      "Rollback verification: OK",
    );
    console.log(
      "Cart status:",
      currentCart.status,
    );
    console.log(
      "Inventory reserved:",
      inventory.reserved,
    );
    console.log(
      "Orders created:",
      orders.length,
    );
  } catch (error) {
    console.error(
      "Rollback verification: FAILED",
    );
    console.error(error);
    process.exitCode = 1;
  } finally {
    if (cartId) {
      await prisma.cartItem.deleteMany({
        where: {
          cartId,
        },
      });

      await prisma.cart.delete({
        where: {
          id: cartId,
        },
      });
    }

    if (productId) {
      await prisma.inventory.deleteMany({
        where: {
          productId,
        },
      });

      await prisma.product.delete({
        where: {
          id: productId,
        },
      });
    }

    if (customerId) {
      await prisma.customer.delete({
        where: {
          id: customerId,
        },
      });
    }
  }
}

void main();