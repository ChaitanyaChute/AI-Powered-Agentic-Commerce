import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import request from "supertest";

import {
  CartRepository,
  CustomerRepository,
  InventoryRepository,
  OrderRepository,
  ProductRepository,
  prisma,
} from "@repo/database";

import { createApp } from "../../app.js";

describe("Orders API", () => {
  const app = createApp();

  const customerRepository =
    new CustomerRepository();

  const productRepository =
    new ProductRepository();

  const inventoryRepository =
    new InventoryRepository();

  const cartRepository =
    new CartRepository();

  const orderRepository =
    new OrderRepository();

  let customerId: string;
  let otherCustomerId: string;

  let productId: string;
  let inactiveProductId: string;
  let noInventoryProductId: string;

  let cartId: string;
  let emptyCartId: string;
  let inactiveCartId: string;
  let invalidQuantityCartId: string;
  let insufficientInventoryCartId: string;
  let inactiveProductCartId: string;
  let noInventoryCartId: string;
  let rollbackCartId: string;

  const testCartIds: string[] = [];

  async function createOrderCart(
    quantity = 2,
  ): Promise<string> {
    const cart =
      await cartRepository.create({
        customer: {
          connect: {
            id: customerId,
          },
        },
      });

    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId,
        quantity,
      },
    });

    testCartIds.push(cart.id);

    return cart.id;
  }

  async function createStateMachineOrder(
    status:
      | "CREATED"
      | "PAYMENT_PENDING"
      | "PAID"
      | "PROCESSING"
      | "COMPLETED"
      | "PAYMENT_FAILED"
      | "CANCELLED"
      | "REFUND_PENDING"
      | "REFUNDED" = "CREATED",
  ): Promise<string> {
    const order =
      await prisma.order.create({
        data: {
          orderNumber:
            `STATE-${Date.now()}-${Math.random()
              .toString(36)
              .slice(2, 8)}`,
          customerId,
          status,
          currency: "INR",
          subtotalMinor: 0,
          totalMinor: 0,
        },
      });

    return order.id;
  }

  beforeAll(async () => {
    const suffix = Date.now();

    const customer =
      await customerRepository.create({
        email:
          `api-checkout-${suffix}@example.com`,
        name: "API Checkout Test",
      });

    customerId = customer.id;

    const otherCustomer =
      await customerRepository.create({
        email:
          `api-checkout-other-${suffix}@example.com`,
        name: "API Checkout Other Customer",
      });

    otherCustomerId =
      otherCustomer.id;

    const product =
      await productRepository.create({
        sku:
          `API-CHECKOUT-${suffix}`,
        name:
          "API Checkout Product",
        priceMinor: 1500,
        currency: "INR",
        active: true,
      });

    productId = product.id;

    await inventoryRepository.create(
      product.id,
      10,
    );

    const cart =
      await cartRepository.create({
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

    const emptyCart =
      await cartRepository.create({
        customer: {
          connect: {
            id: customer.id,
          },
        },
      });

    emptyCartId =
      emptyCart.id;

    const inactiveCart =
      await cartRepository.create({
        customer: {
          connect: {
            id: customer.id,
          },
        },
        status: "CONVERTED",
      });

    inactiveCartId =
      inactiveCart.id;

    const invalidQuantityCart =
      await cartRepository.create({
        customer: {
          connect: {
            id: customer.id,
          },
        },
      });

    invalidQuantityCartId =
      invalidQuantityCart.id;

    await prisma.cartItem.create({
      data: {
        cartId:
          invalidQuantityCart.id,
        productId,
        quantity: 0,
      },
    });

    const insufficientInventoryCart =
      await cartRepository.create({
        customer: {
          connect: {
            id: customer.id,
          },
        },
      });

    insufficientInventoryCartId =
      insufficientInventoryCart.id;

    await prisma.cartItem.create({
      data: {
        cartId:
          insufficientInventoryCart.id,
        productId,
        quantity: 11,
      },
    });

    const inactiveProduct =
      await productRepository.create({
        sku:
          `API-INACTIVE-PRODUCT-${suffix}`,
        name:
          "API Inactive Product",
        priceMinor: 2000,
        currency: "INR",
        active: false,
      });

    inactiveProductId =
      inactiveProduct.id;

    await inventoryRepository.create(
      inactiveProduct.id,
      10,
    );

    const inactiveProductCart =
      await cartRepository.create({
        customer: {
          connect: {
            id: customer.id,
          },
        },
      });

    inactiveProductCartId =
      inactiveProductCart.id;

    await prisma.cartItem.create({
      data: {
        cartId:
          inactiveProductCart.id,
        productId:
          inactiveProduct.id,
        quantity: 1,
      },
    });

    const noInventoryProduct =
      await productRepository.create({
        sku:
          `API-NO-INVENTORY-${suffix}`,
        name:
          "API Product Without Inventory",
        priceMinor: 2500,
        currency: "INR",
        active: true,
      });

    noInventoryProductId =
      noInventoryProduct.id;

    const noInventoryCart =
      await cartRepository.create({
        customer: {
          connect: {
            id: customer.id,
          },
        },
      });

    noInventoryCartId =
      noInventoryCart.id;

    await prisma.cartItem.create({
      data: {
        cartId:
          noInventoryCart.id,
        productId:
          noInventoryProduct.id,
        quantity: 1,
      },
    });

    const rollbackCart =
      await cartRepository.create({
        customer: {
          connect: {
            id: customer.id,
          },
        },
      });

    rollbackCartId =
      rollbackCart.id;

    await prisma.cartItem.create({
      data: {
        cartId:
          rollbackCart.id,
        productId,
        quantity: 11,
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

    const cartIds = [
      cartId,
      emptyCartId,
      inactiveCartId,
      invalidQuantityCartId,
      insufficientInventoryCartId,
      inactiveProductCartId,
      noInventoryCartId,
      rollbackCartId,
      ...testCartIds,
    ];

    await prisma.cartItem.deleteMany({
      where: {
        cartId: {
          in: cartIds,
        },
      },
    });

    await prisma.cart.deleteMany({
      where: {
        id: {
          in: cartIds,
        },
      },
    });

    await prisma.inventory.deleteMany({
      where: {
        productId: {
          in: [
            productId,
            inactiveProductId,
          ],
        },
      },
    });

    await prisma.product.deleteMany({
      where: {
        id: {
          in: [
            productId,
            inactiveProductId,
            noInventoryProductId,
          ],
        },
      },
    });

    await prisma.customer.deleteMany({
      where: {
        id: {
          in: [
            customerId,
            otherCustomerId,
          ],
        },
      },
    });

    await prisma.$disconnect();
  });

  describe("POST /api/orders", () => {
    it("rejects a request with missing customerId", async () => {
      const response =
        await request(app)
          .post("/api/orders")
          .send({
            cartId,
          });

      expect(response.status).toBe(400);
    });

    it("rejects a request with missing cartId", async () => {
      const response =
        await request(app)
          .post("/api/orders")
          .send({
            customerId,
          });

      expect(response.status).toBe(400);
    });

    it("rejects a request with invalid customerId", async () => {
      const response =
        await request(app)
          .post("/api/orders")
          .send({
            customerId: "",
            cartId,
          });

      expect(response.status).toBe(400);
    });

    it("rejects a request with invalid cartId", async () => {
      const response =
        await request(app)
          .post("/api/orders")
          .send({
            customerId,
            cartId: "",
          });

      expect(response.status).toBe(400);
    });

    it("rejects a request with a non-existent customer", async () => {
      const response =
        await request(app)
          .post("/api/orders")
          .send({
            customerId:
              "00000000-0000-0000-0000-000000000000",
            cartId,
          });

      expect(response.status).toBe(404);

      expect(response.body.error).toMatchObject({
        code: "CUSTOMER_NOT_FOUND",
        message:
          "Customer not found.",
      });
    });

    it("rejects a request with a non-existent cart", async () => {
      const response =
        await request(app)
          .post("/api/orders")
          .send({
            customerId,
            cartId:
              "00000000-0000-0000-0000-000000000000",
          });

      expect(response.status).toBe(404);

      expect(response.body.error).toMatchObject({
        code: "CART_NOT_FOUND",
        message:
          "Cart not found.",
      });
    });

    it("rejects a request when the cart belongs to another customer", async () => {
      const response =
        await request(app)
          .post("/api/orders")
          .send({
            customerId:
              otherCustomerId,
            cartId,
          });

      expect(response.status).toBe(403);

      expect(response.body.error).toMatchObject({
        code:
          "CART_CUSTOMER_MISMATCH",
        message:
          "Cart does not belong to customer.",
      });
    });

    it("rejects a request with an empty cart", async () => {
      const response =
        await request(app)
          .post("/api/orders")
          .send({
            customerId,
            cartId:
              emptyCartId,
          });

      expect(response.status).toBe(400);

      expect(response.body.error).toMatchObject({
        code: "EMPTY_CART",
        message:
          "Cannot create order from an empty cart.",
      });
    });

    it("rejects a request with an inactive cart", async () => {
      const response =
        await request(app)
          .post("/api/orders")
          .send({
            customerId,
            cartId:
              inactiveCartId,
          });

      expect(response.status).toBe(400);

      expect(response.body.error).toMatchObject({
        code:
          "CART_NOT_ACTIVE",
        message:
          "Cart is not active.",
      });
    });

    it("rejects a request with an invalid cart item quantity", async () => {
      const response =
        await request(app)
          .post("/api/orders")
          .send({
            customerId,
            cartId:
              invalidQuantityCartId,
          });

      expect(response.status).toBe(400);

      expect(response.body.error).toMatchObject({
        code:
          "INVALID_CART_ITEM_QUANTITY",
      });
    });

    it("rejects a request with insufficient inventory", async () => {
      const response =
        await request(app)
          .post("/api/orders")
          .send({
            customerId,
            cartId:
              insufficientInventoryCartId,
          });

      expect(response.status).toBe(409);

      expect(response.body.error).toMatchObject({
        code:
          "INSUFFICIENT_INVENTORY",
      });
    });

    it("rejects a request with an inactive product", async () => {
      const response =
        await request(app)
          .post("/api/orders")
          .send({
            customerId,
            cartId:
              inactiveProductCartId,
          });

      expect(response.status).toBe(400);

      expect(response.body.error).toMatchObject({
        code:
          "PRODUCT_NOT_ACTIVE",
      });
    });

    it("rejects a request when inventory is missing", async () => {
      const response =
        await request(app)
          .post("/api/orders")
          .send({
            customerId,
            cartId:
              noInventoryCartId,
          });

      expect(response.status).toBe(404);

      expect(response.body.error).toMatchObject({
        code:
          "INVENTORY_NOT_FOUND",
      });
    });

    it("rolls back order creation and inventory changes when checkout fails", async () => {
      const ordersBefore =
        await orderRepository.listByCustomerId(
          customerId,
        );

      const inventoryBefore =
        await inventoryRepository.findByProductId(
          productId,
        );

      expect(
        inventoryBefore,
      ).not.toBeNull();

      expect(
        inventoryBefore?.quantity,
      ).toBe(10);

      expect(
        inventoryBefore?.reserved,
      ).toBe(0);

      const cartBefore =
        await cartRepository.findByIdWithItems(
          rollbackCartId,
        );

      expect(
        cartBefore,
      ).not.toBeNull();

      expect(
        cartBefore?.status,
      ).toBe("ACTIVE");

      const response =
        await request(app)
          .post("/api/orders")
          .send({
            customerId,
            cartId:
              rollbackCartId,
          });

      expect(response.status).toBe(409);

      expect(response.body.error).toMatchObject({
        code:
          "INSUFFICIENT_INVENTORY",
      });

      const ordersAfter =
        await orderRepository.listByCustomerId(
          customerId,
        );

      expect(
        ordersAfter,
      ).toHaveLength(
        ordersBefore.length,
      );

      const cartAfter =
        await cartRepository.findByIdWithItems(
          rollbackCartId,
        );

      expect(
        cartAfter,
      ).not.toBeNull();

      expect(
        cartAfter?.status,
      ).toBe("ACTIVE");

      const inventoryAfter =
        await inventoryRepository.findByProductId(
          productId,
        );

      expect(
        inventoryAfter,
      ).not.toBeNull();

      expect(
        inventoryAfter?.quantity,
      ).toBe(10);

      expect(
        inventoryAfter?.reserved,
      ).toBe(0);
    });

    it("creates an order and updates checkout state correctly", async () => {
      const response =
        await request(app)
          .post("/api/orders")
          .send({
            customerId,
            cartId,
          });

      expect(response.status).toBe(201);

      expect(
        response.body.data,
      ).toMatchObject({
        customerId,
        status: "CREATED",
        subtotalMinor: 3000,
        totalMinor: 3000,
        currency: "INR",
      });

      const orderId =
        response.body.data.id;

      expect(orderId).toBeDefined();

      const order =
        await orderRepository.findByIdWithItems(
          orderId,
        );

      expect(order).not.toBeNull();

      expect(order?.customerId).toBe(
        customerId,
      );

      expect(order?.status).toBe(
        "CREATED",
      );

      expect(order?.subtotalMinor).toBe(
        3000,
      );

      expect(order?.totalMinor).toBe(
        3000,
      );

      expect(
        order?.items,
      ).toHaveLength(1);

      expect(
        order?.items[0],
      ).toMatchObject({
        productId,
        productName:
          "API Checkout Product",
        sku: expect.stringContaining(
          "API-CHECKOUT-",
        ),
        unitPriceMinor: 1500,
        currency: "INR",
        quantity: 2,
        totalMinor: 3000,
      });

      const inventory =
        await inventoryRepository.findByProductId(
          productId,
        );

      expect(
        inventory,
      ).not.toBeNull();

      expect(
        inventory?.quantity,
      ).toBe(10);

      expect(
        inventory?.reserved,
      ).toBe(2);

      const cart =
        await cartRepository.findByIdWithItems(
          cartId,
        );

      expect(
        cart,
      ).not.toBeNull();

      expect(
        cart?.status,
      ).toBe("CONVERTED");
    });

    it("creates an order once when the same idempotency key is reused", async () => {
      const testCartId =
        await createOrderCart(1);

      const idempotencyKey =
        `order-idempotency-${Date.now()}`;

      const ordersBefore =
        await orderRepository.listByCustomerId(
          customerId,
        );

      const firstResponse =
        await request(app)
          .post("/api/orders")
          .set(
            "Idempotency-Key",
            idempotencyKey,
          )
          .send({
            customerId,
            cartId:
              testCartId,
          });

      expect(
        firstResponse.status,
      ).toBe(201);

      const secondResponse =
        await request(app)
          .post("/api/orders")
          .set(
            "Idempotency-Key",
            idempotencyKey,
          )
          .send({
            customerId,
            cartId:
              testCartId,
          });

      expect(
        secondResponse.status,
      ).toBe(201);

      expect(
        secondResponse.body,
      ).toEqual(
        firstResponse.body,
      );

      expect(
        secondResponse.body.data.id,
      ).toBe(
        firstResponse.body.data.id,
      );

      const ordersAfter =
        await orderRepository.listByCustomerId(
          customerId,
        );

      expect(
        ordersAfter,
      ).toHaveLength(
        ordersBefore.length + 1,
      );

      const inventory =
        await inventoryRepository.findByProductId(
          productId,
        );

      expect(
        inventory,
      ).not.toBeNull();

      expect(
        inventory?.reserved,
      ).toBe(3);
    });

    it("rejects reuse of an idempotency key with a different request", async () => {
      const firstCartId =
        await createOrderCart(1);

      const secondCartId =
        await createOrderCart(1);

      const idempotencyKey =
        `order-idempotency-conflict-${Date.now()}`;

      const firstResponse =
        await request(app)
          .post("/api/orders")
          .set(
            "Idempotency-Key",
            idempotencyKey,
          )
          .send({
            customerId,
            cartId:
              firstCartId,
          });

      expect(
        firstResponse.status,
      ).toBe(201);

      const secondResponse =
        await request(app)
          .post("/api/orders")
          .set(
            "Idempotency-Key",
            idempotencyKey,
          )
          .send({
            customerId,
            cartId:
              secondCartId,
          });

      expect(
        secondResponse.status,
      ).toBe(409);

      expect(
        secondResponse.body.error,
      ).toMatchObject({
        code:
          "IDEMPOTENCY_KEY_REUSED",
        message:
          "Idempotency key was already used with a different request.",
      });

      const secondCart =
        await cartRepository.findByIdWithItems(
          secondCartId,
        );

      expect(
        secondCart,
      ).not.toBeNull();

      expect(
        secondCart?.status,
      ).toBe("ACTIVE");
    });

    it("allows normal order creation without an idempotency key", async () => {
      const testCartId =
        await createOrderCart(1);

      const response =
        await request(app)
          .post("/api/orders")
          .send({
            customerId,
            cartId:
              testCartId,
          });

      expect(response.status).toBe(201);

      expect(
        response.body.data,
      ).toMatchObject({
        customerId,
        status: "CREATED",
        subtotalMinor: 1500,
        totalMinor: 1500,
        currency: "INR",
      });
    });
  });

  describe("GET /api/orders/:id", () => {
    it("returns an existing order by ID", async () => {
      const testCartId =
        await createOrderCart(1);

      const createResponse =
        await request(app)
          .post("/api/orders")
          .send({
            customerId,
            cartId:
              testCartId,
          });

      expect(
        createResponse.status,
      ).toBe(201);

      const createdOrder =
        createResponse.body.data;

      expect(
        createdOrder.id,
      ).toBeDefined();

      const response =
        await request(app).get(
          `/api/orders/${createdOrder.id}`,
        );

      expect(
        response.status,
      ).toBe(200);

      expect(
        response.body.data,
      ).toMatchObject({
        id: createdOrder.id,
        customerId,
        status: "CREATED",
        subtotalMinor: 1500,
        totalMinor: 1500,
        currency: "INR",
      });
    });

    it("returns order items when retrieving an order", async () => {
      const testCartId =
        await createOrderCart(2);

      const createResponse =
        await request(app)
          .post("/api/orders")
          .send({
            customerId,
            cartId:
              testCartId,
          });

      expect(
        createResponse.status,
      ).toBe(201);

      const orderId =
        createResponse.body.data.id;

      const response =
        await request(app).get(
          `/api/orders/${orderId}`,
        );

      expect(
        response.status,
      ).toBe(200);

      expect(
        response.body.data.items,
      ).toHaveLength(1);

      expect(
        response.body.data.items[0],
      ).toMatchObject({
        productId,
        productName:
          "API Checkout Product",
        unitPriceMinor: 1500,
        quantity: 2,
        totalMinor: 3000,
        currency: "INR",
      });
    });

    it("rejects a request for a non-existent order", async () => {
      const response =
        await request(app).get(
          "/api/orders/00000000-0000-0000-0000-000000000000",
        );

      expect(
        response.status,
      ).toBe(404);

      expect(
        response.body.error,
      ).toMatchObject({
        code: "ORDER_NOT_FOUND",
        message:
          "Order not found.",
      });
    });

    it("rejects a request with a non-existent but valid order ID", async () => {
      const response =
        await request(app).get(
          "/api/orders/11111111-1111-1111-1111-111111111111",
        );

      expect(
        response.status,
      ).toBe(404);

      expect(
        response.body.error,
      ).toMatchObject({
        code: "ORDER_NOT_FOUND",
        message:
          "Order not found.",
      });
    });
  });

  describe("PATCH /api/orders/:id/status", () => {
    it("allows CREATED → PAYMENT_PENDING", async () => {
      const orderId =
        await createStateMachineOrder(
          "CREATED",
        );

      const response =
        await request(app)
          .patch(
            `/api/orders/${orderId}/status`,
          )
          .send({
            status: "PAYMENT_PENDING",
          });

      expect(response.status).toBe(200);

      expect(
        response.body.data,
      ).toMatchObject({
        id: orderId,
        status: "PAYMENT_PENDING",
      });
    });

    it("allows PAYMENT_PENDING → PAID", async () => {
      const orderId =
        await createStateMachineOrder(
          "PAYMENT_PENDING",
        );

      const response =
        await request(app)
          .patch(
            `/api/orders/${orderId}/status`,
          )
          .send({
            status: "PAID",
          });

      expect(response.status).toBe(200);

      expect(
        response.body.data,
      ).toMatchObject({
        id: orderId,
        status: "PAID",
      });
    });

    it("allows PAID → PROCESSING", async () => {
      const orderId =
        await createStateMachineOrder(
          "PAID",
        );

      const response =
        await request(app)
          .patch(
            `/api/orders/${orderId}/status`,
          )
          .send({
            status: "PROCESSING",
          });

      expect(response.status).toBe(200);

      expect(
        response.body.data,
      ).toMatchObject({
        id: orderId,
        status: "PROCESSING",
      });
    });

    it("allows PROCESSING → COMPLETED", async () => {
      const orderId =
        await createStateMachineOrder(
          "PROCESSING",
        );

      const response =
        await request(app)
          .patch(
            `/api/orders/${orderId}/status`,
          )
          .send({
            status: "COMPLETED",
          });

      expect(response.status).toBe(200);

      expect(
        response.body.data,
      ).toMatchObject({
        id: orderId,
        status: "COMPLETED",
      });
    });

    it("allows PAYMENT_PENDING → PAYMENT_FAILED", async () => {
      const orderId =
        await createStateMachineOrder(
          "PAYMENT_PENDING",
        );

      const response =
        await request(app)
          .patch(
            `/api/orders/${orderId}/status`,
          )
          .send({
            status: "PAYMENT_FAILED",
          });

      expect(response.status).toBe(200);

      expect(
        response.body.data,
      ).toMatchObject({
        id: orderId,
        status: "PAYMENT_FAILED",
      });
    });

    it("allows CREATED → CANCELLED", async () => {
      const orderId =
        await createStateMachineOrder(
          "CREATED",
        );

      const response =
        await request(app)
          .patch(
            `/api/orders/${orderId}/status`,
          )
          .send({
            status: "CANCELLED",
          });

      expect(response.status).toBe(200);

      expect(
        response.body.data,
      ).toMatchObject({
        id: orderId,
        status: "CANCELLED",
      });
    });

    it("allows PAID → REFUND_PENDING", async () => {
      const orderId =
        await createStateMachineOrder(
          "PAID",
        );

      const response =
        await request(app)
          .patch(
            `/api/orders/${orderId}/status`,
          )
          .send({
            status: "REFUND_PENDING",
          });

      expect(response.status).toBe(200);

      expect(
        response.body.data,
      ).toMatchObject({
        id: orderId,
        status: "REFUND_PENDING",
      });
    });

    it("allows REFUND_PENDING → REFUNDED", async () => {
      const orderId =
        await createStateMachineOrder(
          "REFUND_PENDING",
        );

      const response =
        await request(app)
          .patch(
            `/api/orders/${orderId}/status`,
          )
          .send({
            status: "REFUNDED",
          });

      expect(response.status).toBe(200);

      expect(
        response.body.data,
      ).toMatchObject({
        id: orderId,
        status: "REFUNDED",
      });
    });

    it("rejects CREATED → PAID", async () => {
      const orderId =
        await createStateMachineOrder(
          "CREATED",
        );

      const response =
        await request(app)
          .patch(
            `/api/orders/${orderId}/status`,
          )
          .send({
            status: "PAID",
          });

      expect(response.status).toBe(409);

      expect(
        response.body.error,
      ).toMatchObject({
        code:
          "INVALID_ORDER_STATUS_TRANSITION",
      });
    });

    it("rejects CREATED → PROCESSING", async () => {
      const orderId =
        await createStateMachineOrder(
          "CREATED",
        );

      const response =
        await request(app)
          .patch(
            `/api/orders/${orderId}/status`,
          )
          .send({
            status: "PROCESSING",
          });

      expect(response.status).toBe(409);

      expect(
        response.body.error,
      ).toMatchObject({
        code:
          "INVALID_ORDER_STATUS_TRANSITION",
      });
    });

    it("rejects PAYMENT_PENDING → COMPLETED", async () => {
      const orderId =
        await createStateMachineOrder(
          "PAYMENT_PENDING",
        );

      const response =
        await request(app)
          .patch(
            `/api/orders/${orderId}/status`,
          )
          .send({
            status: "COMPLETED",
          });

      expect(response.status).toBe(409);

      expect(
        response.body.error,
      ).toMatchObject({
        code:
          "INVALID_ORDER_STATUS_TRANSITION",
      });
    });

    it("rejects PAID → CANCELLED", async () => {
      const orderId =
        await createStateMachineOrder(
          "PAID",
        );

      const response =
        await request(app)
          .patch(
            `/api/orders/${orderId}/status`,
          )
          .send({
            status: "CANCELLED",
          });

      expect(response.status).toBe(409);

      expect(
        response.body.error,
      ).toMatchObject({
        code:
          "INVALID_ORDER_STATUS_TRANSITION",
      });
    });

    it("rejects COMPLETED → PAID", async () => {
      const orderId =
        await createStateMachineOrder(
          "COMPLETED",
        );

      const response =
        await request(app)
          .patch(
            `/api/orders/${orderId}/status`,
          )
          .send({
            status: "PAID",
          });

      expect(response.status).toBe(409);

      expect(
        response.body.error,
      ).toMatchObject({
        code:
          "INVALID_ORDER_STATUS_TRANSITION",
      });
    });

    it("rejects REFUNDED → PAID", async () => {
      const orderId =
        await createStateMachineOrder(
          "REFUNDED",
        );

      const response =
        await request(app)
          .patch(
            `/api/orders/${orderId}/status`,
          )
          .send({
            status: "PAID",
          });

      expect(response.status).toBe(409);

      expect(
        response.body.error,
      ).toMatchObject({
        code:
          "INVALID_ORDER_STATUS_TRANSITION",
      });
    });

    it("rejects a transition for a non-existent order", async () => {
      const response =
        await request(app)
          .patch(
            "/api/orders/00000000-0000-0000-0000-000000000000/status",
          )
          .send({
            status: "PAID",
          });

      expect(response.status).toBe(404);

      expect(
        response.body.error,
      ).toMatchObject({
        code: "ORDER_NOT_FOUND",
        message:
          "Order not found.",
      });
    });
  });
});