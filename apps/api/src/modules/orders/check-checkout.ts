import {CartRepository,CustomerRepository,InventoryRepository,OrderItemRepository,OrderRepository,ProductRepository,prisma} from "@repo/database";
import { OrderService } from "./order.service.js";

async function main(): Promise<void> {
  let customerId: string | undefined;
  let productId: string | undefined;
  let cartId: string | undefined;
  let orderId: string | undefined;

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
      email: `checkout-smoke-${suffix}@example.com`,
      name: "Checkout Smoke Customer",
    });

    customerId = customer.id;

    const product = await productRepository.create({
      sku: `CHECKOUT-SMOKE-${suffix}`,
      name: "Checkout Smoke Product",
      description: "Temporary checkout test product",
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
        quantity: 2,
      },
    });

    const order = await orderService.createOrderFromCart(
      customer.id,
      cart.id,
    );

    if (!order) {
      throw new Error("Order was not created.");
    }

    orderId = order.id;

    if (order.status !== "PENDING") {
      throw new Error(
        `Expected order status PENDING, got ${order.status}.`,
      );
    }

    if (order.totalMinor !== 2000) {
      throw new Error(
        `Expected total 2000, got ${order.totalMinor}.`,
      );
    }

    if (order.items.length !== 1) {
      throw new Error(
        `Expected 1 order item, got ${order.items.length}.`,
      );
    }

    const inventory =
      await inventoryRepository.findByProductId(
        product.id,
      );

    if (!inventory) {
      throw new Error("Inventory was not found.");
    }

    if (inventory.reserved !== 2) {
      throw new Error(
        `Expected reserved quantity 2, got ${inventory.reserved}.`,
      );
    }

    const convertedCart =
      await cartRepository.findById(cart.id);

    if (!convertedCart) {
      throw new Error("Cart was not found.");
    }

    if (convertedCart.status !== "CONVERTED") {
      throw new Error(
        `Expected cart CONVERTED, got ${convertedCart.status}.`,
      );
    }

    console.log("Checkout transaction: OK");
    console.log("Order:", order.orderNumber);
    console.log("Order total:", order.totalMinor);
    console.log("Inventory reserved:", inventory.reserved);
    console.log("Cart status:", convertedCart.status);
  } catch (error) {
    console.error("Checkout transaction: FAILED");
    console.error(error);
    process.exitCode = 1;
  } finally {
    if (orderId) {
      await prisma.orderItem.deleteMany({
        where: {
          orderId,
        },
      });

      await prisma.order.delete({
        where: {
          id: orderId,
        },
      });
    }

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