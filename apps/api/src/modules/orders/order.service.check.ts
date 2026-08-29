import {afterAll,beforeAll,describe,expect,it} from "vitest";
import request from "supertest";
import {CartRepository,CustomerRepository,InventoryRepository,ProductRepository,prisma} from "@repo/database";
import { createApp } from "../../app.js";

describe("POST /api/orders", () => {
  const app = createApp();

  const customerRepository = new CustomerRepository();
  const productRepository = new ProductRepository();
  const inventoryRepository = new InventoryRepository();
  const cartRepository = new CartRepository();

  let customerId: string;
  let productId: string;
  let cartId: string;

  beforeAll(async () => {
    const suffix = Date.now();

    const customer = await customerRepository.create({
      email: `api-checkout-${suffix}@example.com`,
      name: "API Checkout Test",
    });

    customerId = customer.id;

    const product = await productRepository.create({
      sku: `API-CHECKOUT-${suffix}`,
      name: "API Checkout Product",
      priceMinor: 1500,
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
  });

  afterAll(async () => {
    await prisma.orderItem.deleteMany({
      where: {
        order: {
          customerId,
        },
      },
    });

    await prisma.order.deleteMany({
      where: {
        customerId,
      },
    });

    await prisma.cartItem.deleteMany({
      where: {
        cartId,
      },
    });

    await prisma.cart.deleteMany({
      where: {
        id: cartId,
      },
    });

    await prisma.inventory.deleteMany({
      where: {
        productId,
      },
    });

    await prisma.product.deleteMany({
      where: {
        id: productId,
      },
    });

    await prisma.customer.deleteMany({
      where: {
        id: customerId,
      },
    });

    await prisma.$disconnect();
  });

  it("creates an order from the cart", async () => {
    const response = await request(app)
      .post("/api/orders")
      .send({
        customerId,
        cartId,
      });

    expect(response.status).toBe(201);

    expect(response.body.data).toMatchObject({
      customerId,
      status: "PENDING",
      subtotalMinor: 3000,
      totalMinor: 3000,
    });
  });

  it("rejects a request with a non-existent customer", async () => {
  const response = await request(app)
    .post("/api/orders")
    .send({
      customerId: "00000000-0000-0000-0000-000000000000",
      cartId,
    });

  expect(response.status).toBe(404);

  expect(response.body.error).toMatchObject({
    code: "CUSTOMER_NOT_FOUND",
    message: "Customer not found.",
  });
});
it("rejects a request with missing customerId", async () => {
  const response = await request(app)
    .post("/api/orders")
    .send({
      cartId,
    });

  expect(response.status).toBe(400);
});

it("rejects a request with missing cartId", async () => {
  const response = await request(app)
    .post("/api/orders")
    .send({
      customerId,
    });

  expect(response.status).toBe(400);
});

it("rejects a request with invalid customerId", async () => {
  const response = await request(app)
    .post("/api/orders")
    .send({
      customerId: "",
      cartId,
    });

  expect(response.status).toBe(400);
});

it("rejects a request with invalid cartId", async () => {
  const response = await request(app)
    .post("/api/orders")
    .send({
      customerId,
      cartId: "",
    });

  expect(response.status).toBe(400);
});
});