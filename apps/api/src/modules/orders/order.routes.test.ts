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
  InventoryReservationRepository
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
  let cancellationProductId: string;

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

  async function createCancellationOrderCart(
    quantity = 1,
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
        productId: cancellationProductId,
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

    const cancellationProduct =
      await productRepository.create({
        sku:
          `API-CANCELLATION-${suffix}`,
        name:
          "API Cancellation Product",
        priceMinor: 1500,
        currency: "INR",
        active: true,
      });

    cancellationProductId =
      cancellationProduct.id;

    await inventoryRepository.create(
      cancellationProduct.id,
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

    await prisma.inventoryReservation.deleteMany({
  where: {
    order: {
      customerId,
    },
  },
});

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
            cancellationProductId,
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
            cancellationProductId,
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

    describe("DELETE /api/orders/:id", () => {
    it("cancels a CREATED order", async () => {
      const testCartId =
        await createCancellationOrderCart(1);

      const createResponse =
        await request(app)
          .post("/api/orders")
          .send({
            customerId,
            cartId: testCartId,
          });

      expect(createResponse.status).toBe(201);

      const orderId =
        createResponse.body.data.id;

      const cancelResponse =
        await request(app)
          .delete(`/api/orders/${orderId}`);

      expect(cancelResponse.status).toBe(200);

      expect(
        cancelResponse.body.data,
      ).toMatchObject({
        id: orderId,
        customerId,
        status: "CANCELLED",
      });

      const order =
        await orderRepository.findByIdWithItems(
          orderId,
        );

      expect(order).not.toBeNull();

      expect(order?.status).toBe(
        "CANCELLED",
      );
    });

    it("releases reserved inventory when cancelling an order", async () => {
      const inventoryBefore =
        await inventoryRepository.findByProductId(
          cancellationProductId,
        );

      expect(inventoryBefore).not.toBeNull();

      const reservedBefore =
        inventoryBefore?.reserved ?? 0;

      const testCartId =
        await createCancellationOrderCart(1);

      const createResponse =
        await request(app)
          .post("/api/orders")
          .send({
            customerId,
            cartId: testCartId,
          });

      expect(createResponse.status).toBe(201);

      const orderId =
        createResponse.body.data.id;

      const inventoryAfterCreate =
        await inventoryRepository.findByProductId(
          cancellationProductId,
        );

      expect(
        inventoryAfterCreate,
      ).not.toBeNull();

      expect(
        inventoryAfterCreate?.reserved,
      ).toBe(reservedBefore + 1);

      const cancelResponse =
        await request(app)
          .delete(`/api/orders/${orderId}`);

      expect(cancelResponse.status).toBe(200);

      expect(
        cancelResponse.body.data.status,
      ).toBe("CANCELLED");

      const inventoryAfterCancel =
        await inventoryRepository.findByProductId(
          cancellationProductId,
        );

      expect(
        inventoryAfterCancel,
      ).not.toBeNull();

      expect(
        inventoryAfterCancel?.reserved,
      ).toBe(reservedBefore);
    });

    it("does not release inventory twice when cancellation is repeated", async () => {
      const testCartId =
        await createCancellationOrderCart(1);

      const createResponse =
        await request(app)
          .post("/api/orders")
          .send({
            customerId,
            cartId: testCartId,
          });

      expect(createResponse.status).toBe(201);

      const orderId =
        createResponse.body.data.id;

      const inventoryBeforeCancel =
        await inventoryRepository.findByProductId(
          cancellationProductId,
        );

      expect(
        inventoryBeforeCancel,
      ).not.toBeNull();

      const reservedBeforeCancel =
        inventoryBeforeCancel?.reserved ?? 0;

      const firstCancelResponse =
        await request(app)
          .delete(`/api/orders/${orderId}`);

      expect(
        firstCancelResponse.status,
      ).toBe(200);

      expect(
        firstCancelResponse.body.data.status,
      ).toBe("CANCELLED");

      const inventoryAfterFirstCancel =
        await inventoryRepository.findByProductId(
          cancellationProductId,
        );

      expect(
        inventoryAfterFirstCancel,
      ).not.toBeNull();

      expect(
        inventoryAfterFirstCancel?.reserved,
      ).toBe(reservedBeforeCancel - 1);

      const secondCancelResponse =
        await request(app)
          .delete(`/api/orders/${orderId}`);

      expect(
        secondCancelResponse.status,
      ).toBe(200);

      expect(
        secondCancelResponse.body.data,
      ).toEqual(
        firstCancelResponse.body.data,
      );

      const inventoryAfterSecondCancel =
        await inventoryRepository.findByProductId(
          cancellationProductId,
        );

      expect(
        inventoryAfterSecondCancel,
      ).not.toBeNull();

      expect(
        inventoryAfterSecondCancel?.reserved,
      ).toBe(reservedBeforeCancel - 1);
    });

    it("rejects cancellation from PAYMENT_PENDING", async () => {
      const orderId =
        await createStateMachineOrder(
          "PAYMENT_PENDING",
        );

      const response =
        await request(app)
          .delete(`/api/orders/${orderId}`);

      expect(response.status).toBe(409);

      expect(
        response.body.error,
      ).toMatchObject({
        code:
          "INVALID_ORDER_STATUS_TRANSITION",
      });

      const order =
        await orderRepository.findByIdWithItems(
          orderId,
        );

      expect(order).not.toBeNull();

      expect(order?.status).toBe(
        "PAYMENT_PENDING",
      );
    });

    it("rejects cancellation from PAID", async () => {
      const orderId =
        await createStateMachineOrder(
          "PAID",
        );

      const response =
        await request(app)
          .delete(`/api/orders/${orderId}`);

      expect(response.status).toBe(409);

      expect(
        response.body.error,
      ).toMatchObject({
        code:
          "INVALID_ORDER_STATUS_TRANSITION",
      });

      const order =
        await orderRepository.findByIdWithItems(
          orderId,
        );

      expect(order).not.toBeNull();

      expect(order?.status).toBe("PAID");
    });

    it("rejects cancellation from PROCESSING", async () => {
      const orderId =
        await createStateMachineOrder(
          "PROCESSING",
        );

      const response =
        await request(app)
          .delete(`/api/orders/${orderId}`);

      expect(response.status).toBe(409);

      expect(
        response.body.error,
      ).toMatchObject({
        code:
          "INVALID_ORDER_STATUS_TRANSITION",
      });

      const order =
        await orderRepository.findByIdWithItems(
          orderId,
        );

      expect(order).not.toBeNull();

      expect(order?.status).toBe(
        "PROCESSING",
      );
    });

    it("rejects cancellation from COMPLETED", async () => {
      const orderId =
        await createStateMachineOrder(
          "COMPLETED",
        );

      const response =
        await request(app)
          .delete(`/api/orders/${orderId}`);

      expect(response.status).toBe(409);

      expect(
        response.body.error,
      ).toMatchObject({
        code:
          "INVALID_ORDER_STATUS_TRANSITION",
      });

      const order =
        await orderRepository.findByIdWithItems(
          orderId,
        );

      expect(order).not.toBeNull();

      expect(order?.status).toBe(
        "COMPLETED",
      );
    });

    it("rejects cancellation from PAYMENT_FAILED", async () => {
      const orderId =
        await createStateMachineOrder(
          "PAYMENT_FAILED",
        );

      const response =
        await request(app)
          .delete(`/api/orders/${orderId}`);

      expect(response.status).toBe(409);

      expect(
        response.body.error,
      ).toMatchObject({
        code:
          "INVALID_ORDER_STATUS_TRANSITION",
      });

      const order =
        await orderRepository.findByIdWithItems(
          orderId,
        );

      expect(order).not.toBeNull();

      expect(order?.status).toBe(
        "PAYMENT_FAILED",
      );
    });

    it("returns the same cancelled order when cancellation is repeated", async () => {
      const testCartId =
        await createCancellationOrderCart(1);

      const createResponse =
        await request(app)
          .post("/api/orders")
          .send({
            customerId,
            cartId: testCartId,
          });

      expect(createResponse.status).toBe(201);

      const orderId =
        createResponse.body.data.id;

      const firstResponse =
        await request(app)
          .delete(`/api/orders/${orderId}`);

      expect(firstResponse.status).toBe(200);

      const secondResponse =
        await request(app)
          .delete(`/api/orders/${orderId}`);

      expect(secondResponse.status).toBe(200);

      expect(
        secondResponse.body,
      ).toEqual(
        firstResponse.body,
      );
    });

    it("rejects cancellation for a non-existent order", async () => {
      const response =
        await request(app)
          .delete(
            "/api/orders/00000000-0000-0000-0000-000000000000",
          );

      expect(response.status).toBe(404);

      expect(
        response.body.error,
      ).toMatchObject({
        code: "ORDER_NOT_FOUND",
        message: "Order not found.",
      });
    });

    it("rejects cancellation when the order ID is missing", async () => {
      const response =
        await request(app)
          .delete("/api/orders/");

      expect(
        [404, 400],
      ).toContain(response.status);
    });

    it("creates an ACTIVE inventory reservation during checkout", async () => {
  const testCartId =
    await createCancellationOrderCart(2);

  const createResponse =
    await request(app)
      .post("/api/orders")
      .send({
        customerId,
        cartId: testCartId,
      });

  expect(createResponse.status).toBe(201);

  const orderId =
    createResponse.body.data.id;

  const reservations =
    await prisma.inventoryReservation.findMany({
      where: {
        orderId,
      },
    });

  expect(reservations).toHaveLength(1);

  expect(reservations[0]).toMatchObject({
    orderId,
    productId: cancellationProductId,
    quantity: 2,
    status: "ACTIVE",
    releasedAt: null,
  });
});

it("marks the order reservation as RELEASED when the order is cancelled", async () => {
  const testCartId =
    await createCancellationOrderCart(2);

  const createResponse =
    await request(app)
      .post("/api/orders")
      .send({
        customerId,
        cartId: testCartId,
      });

  expect(createResponse.status).toBe(201);

  const orderId =
    createResponse.body.data.id;

  const before =
    await prisma.inventoryReservation.findFirst({
      where: {
        orderId,
        productId: cancellationProductId,
      },
    });

  expect(before).not.toBeNull();

  expect(before?.status).toBe("ACTIVE");
  expect(before?.quantity).toBe(2);
  expect(before?.releasedAt).toBeNull();

  const cancelResponse =
    await request(app)
      .delete(`/api/orders/${orderId}`);

  expect(cancelResponse.status).toBe(200);

  const after =
    await prisma.inventoryReservation.findFirst({
      where: {
        orderId,
        productId: cancellationProductId,
      },
    });

  expect(after).not.toBeNull();

  expect(after?.status).toBe("RELEASED");
  expect(after?.quantity).toBe(2);
  expect(after?.releasedAt).not.toBeNull();
});

it("does not release the same reservation twice", async () => {
  const testCartId =
    await createCancellationOrderCart(1);

  const createResponse =
    await request(app)
      .post("/api/orders")
      .send({
        customerId,
        cartId: testCartId,
      });

  expect(createResponse.status).toBe(201);

  const orderId =
    createResponse.body.data.id;

  const firstCancelResponse =
    await request(app)
      .delete(`/api/orders/${orderId}`);

  expect(firstCancelResponse.status).toBe(200);

  const firstReservation =
    await prisma.inventoryReservation.findFirst({
      where: {
        orderId,
        productId: cancellationProductId,
      },
    });

  expect(firstReservation).not.toBeNull();
  expect(firstReservation?.status).toBe("RELEASED");

  const releasedAt =
    firstReservation?.releasedAt;

  const secondCancelResponse =
    await request(app)
      .delete(`/api/orders/${orderId}`);

  expect(secondCancelResponse.status).toBe(200);

  const secondReservation =
    await prisma.inventoryReservation.findFirst({
      where: {
        orderId,
        productId: cancellationProductId,
      },
    });

  expect(secondReservation).not.toBeNull();

  expect(secondReservation?.status).toBe(
    "RELEASED",
  );

  expect(secondReservation?.releasedAt).toEqual(
    releasedAt,
  );
});

describe("Concurrent checkout protection", () => {
  it(
    "allows only one concurrent checkout when stock is 1",
    async () => {
      const timestamp = Date.now();

      const product =
        await prisma.product.create({
          data: {
            sku: `CONCURRENT-${timestamp}`,
            name: "Concurrent Checkout Product",
            priceMinor: 1500,
            currency: "INR",
            active: true,
          },
        });

      const customers =
        await Promise.all([
          prisma.customer.create({
            data: {
              email:
                `concurrent-a-${timestamp}@example.com`,
              name: "Concurrent Customer A",
            },
          }),
          prisma.customer.create({
            data: {
              email:
                `concurrent-b-${timestamp}@example.com`,
              name: "Concurrent Customer B",
            },
          }),
          prisma.customer.create({
            data: {
              email:
                `concurrent-c-${timestamp}@example.com`,
              name: "Concurrent Customer C",
            },
          }),
        ]);

      try {
        await prisma.inventory.create({
          data: {
            productId: product.id,
            quantity: 1,
            reserved: 0,
          },
        });

        const carts =
          await Promise.all(
            customers.map((customer) =>
              prisma.cart.create({
                data: {
                  customerId: customer.id,
                  status: "ACTIVE",
                  items: {
                    create: {
                      productId:
                        product.id,
                      quantity: 1,
                    },
                  },
                },
              }),
            ),
          );

          const responses =
  await Promise.all(
    carts.map((cart, index) => {
      const customer = customers[index];

      if (!customer) {
        throw new Error(
          `Expected customer at index ${index}.`,
        );
      }

      return request(app)
        .post("/api/orders")
        .send({
          customerId: customer.id,
          cartId: cart.id,
        });
    }),
  );

        const successfulResponses =
          responses.filter(
            (response) =>
              response.status === 201,
          );

        const failedResponses =
          responses.filter(
            (response) =>
              response.status === 409,
          );

        expect(
          successfulResponses,
        ).toHaveLength(1);

        expect(
          failedResponses,
        ).toHaveLength(2);

        for (
          const response of failedResponses
        ) {
          expect(
            response.body.error,
          ).toMatchObject({
            code:
              "INSUFFICIENT_INVENTORY",
          });
        }

        const orders =
          await prisma.order.findMany({
            where: {
              customerId: {
                in: customers.map(
                  (customer) =>
                    customer.id,
                ),
              },
            },
          });

        expect(orders).toHaveLength(1);

        const inventory =
          await prisma.inventory.findUnique({
            where: {
              productId: product.id,
            },
          });

        expect(
          inventory,
        ).not.toBeNull();

        expect(
          inventory?.quantity,
        ).toBe(1);

        expect(
          inventory?.reserved,
        ).toBe(1);

        expect(
          (inventory?.quantity ?? 0) -
            (inventory?.reserved ?? 0),
        ).toBe(0);

        const reservations =
          await prisma.inventoryReservation.findMany({
            where: {
              productId:
                product.id,
            },
          });

        expect(
          reservations,
        ).toHaveLength(1);

        const reservation = reservations[0];

if (!reservation) {
  throw new Error(
    "Expected exactly one inventory reservation.",
  );
}

        expect(
          reservation.quantity,
        ).toBe(1);

        expect(
          reservation.status,
        ).toBe("ACTIVE");
      } finally {
        const orderIds =
          (
            await prisma.order.findMany({
              where: {
                customerId: {
                  in: customers.map(
                    (customer) =>
                      customer.id,
                  ),
                },
              },
              select: {
                id: true,
              },
            })
          ).map(
            (order) => order.id,
          );

        if (orderIds.length > 0) {
          await prisma.inventoryReservation.deleteMany({
            where: {
              orderId: {
                in: orderIds,
              },
            },
          });

          await prisma.orderItem.deleteMany({
            where: {
              orderId: {
                in: orderIds,
              },
            },
          });

          await prisma.order.deleteMany({
            where: {
              id: {
                in: orderIds,
              },
            },
          });
        }

        await prisma.cartItem.deleteMany({
          where: {
            cart: {
              customerId: {
                in: customers.map(
                  (customer) =>
                    customer.id,
                ),
              },
            },
          },
        });

        await prisma.cart.deleteMany({
          where: {
            customerId: {
              in: customers.map(
                (customer) =>
                  customer.id,
              ),
            },
          },
        });

        await prisma.inventory.deleteMany({
          where: {
            productId:
              product.id,
          },
        });

        await prisma.customer.deleteMany({
          where: {
            id: {
              in: customers.map(
                (customer) =>
                  customer.id,
              ),
            },
          },
        });

        await prisma.product.deleteMany({
          where: {
            id: product.id,
          },
        });
      }
    },
  );
});
describe("Commerce Transaction Hardening", () => {
  it("rolls back the entire checkout when inventory reservation fails", async () => {
    const customer = await prisma.customer.create({
      data: {
        email: `step40-reservation-failure-${Date.now()}@example.com`,
        name: "Step 40 Reservation Failure Customer",
      },
    });

    const product = await prisma.product.create({
      data: {
        sku: `STEP40-RESERVATION-${Date.now()}`,
        name: "Step 40 Reservation Failure Product",
        priceMinor: 2500,
        currency: "INR",
        active: true,
      },
    });

    const inventory = await prisma.inventory.create({
      data: {
        productId: product.id,
        quantity: 1,
        reserved: 0,
      },
    });

    const cart = await prisma.cart.create({
      data: {
        customerId: customer.id,
        status: "ACTIVE",
      },
    });

    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId: product.id,
        quantity: 2,
      },
    });

    try {
      const response = await request(app)
        .post("/api/orders")
        .send({
          customerId: customer.id,
          cartId: cart.id,
        });

      expect(response.status).toBe(409);

      expect(response.body.error).toMatchObject({
        code: "INSUFFICIENT_INVENTORY",
      });

      const orders = await prisma.order.findMany({
        where: {
          customerId: customer.id,
        },
      });

      expect(orders).toHaveLength(0);

      const orderItems =
        await prisma.orderItem.findMany({
          where: {
            productId: product.id,
          },
        });

      expect(orderItems).toHaveLength(0);

      const updatedInventory =
        await prisma.inventory.findUnique({
          where: {
            id: inventory.id,
          },
        });

      expect(updatedInventory).not.toBeNull();
      expect(updatedInventory?.quantity).toBe(1);
      expect(updatedInventory?.reserved).toBe(0);

      const updatedCart =
        await prisma.cart.findUnique({
          where: {
            id: cart.id,
          },
        });

      expect(updatedCart?.status).toBe("ACTIVE");

      const reservations =
        await prisma.inventoryReservation.findMany({
          where: {
            productId: product.id,
          },
        });

      expect(reservations).toHaveLength(0);
    } finally {
      await prisma.inventoryReservation.deleteMany({
        where: {
          productId: product.id,
        },
      });

      await prisma.orderItem.deleteMany({
        where: {
          productId: product.id,
        },
      });

      await prisma.cartItem.deleteMany({
        where: {
          cartId: cart.id,
        },
      });

      await prisma.cart.deleteMany({
        where: {
          id: cart.id,
        },
      });

      await prisma.inventory.deleteMany({
        where: {
          id: inventory.id,
        },
      });

      await prisma.product.deleteMany({
        where: {
          id: product.id,
        },
      });

      await prisma.customer.deleteMany({
        where: {
          id: customer.id,
        },
      });
    }
  });

  it("does not leave a converted cart when checkout transaction fails", async () => {
    const customer = await prisma.customer.create({
      data: {
        email: `step40-cart-rollback-${Date.now()}@example.com`,
        name: "Step 40 Cart Rollback Customer",
      },
    });

    const product = await prisma.product.create({
      data: {
        sku: `STEP40-CART-${Date.now()}`,
        name: "Step 40 Cart Rollback Product",
        priceMinor: 3000,
        currency: "INR",
        active: true,
      },
    });

    const inventory = await prisma.inventory.create({
      data: {
        productId: product.id,
        quantity: 1,
        reserved: 0,
      },
    });

    const cart = await prisma.cart.create({
      data: {
        customerId: customer.id,
        status: "ACTIVE",
      },
    });

    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId: product.id,
        quantity: 2,
      },
    });

    try {
      const response = await request(app)
        .post("/api/orders")
        .send({
          customerId: customer.id,
          cartId: cart.id,
        });

      expect(response.status).toBe(409);

      const updatedCart =
        await prisma.cart.findUnique({
          where: {
            id: cart.id,
          },
        });

      expect(updatedCart?.status).toBe("ACTIVE");

      const updatedInventory =
        await prisma.inventory.findUnique({
          where: {
            id: inventory.id,
          },
        });

      expect(updatedInventory?.reserved).toBe(0);
    } finally {
      await prisma.inventoryReservation.deleteMany({
        where: {
          productId: product.id,
        },
      });

      await prisma.orderItem.deleteMany({
        where: {
          productId: product.id,
        },
      });

      await prisma.cartItem.deleteMany({
        where: {
          cartId: cart.id,
        },
      });

      await prisma.cart.deleteMany({
        where: {
          id: cart.id,
        },
      });

      await prisma.inventory.deleteMany({
        where: {
          id: inventory.id,
        },
      });

      await prisma.product.deleteMany({
        where: {
          id: product.id,
        },
      });

      await prisma.customer.deleteMany({
        where: {
          id: customer.id,
        },
      });
    }
  });

  it("does not create a reservation when checkout cannot reserve inventory", async () => {
    const customer = await prisma.customer.create({
      data: {
        email: `step40-no-reservation-${Date.now()}@example.com`,
        name: "Step 40 No Reservation Customer",
      },
    });

    const product = await prisma.product.create({
      data: {
        sku: `STEP40-NORES-${Date.now()}`,
        name: "Step 40 No Reservation Product",
        priceMinor: 4000,
        currency: "INR",
        active: true,
      },
    });

    const inventory = await prisma.inventory.create({
      data: {
        productId: product.id,
        quantity: 0,
        reserved: 0,
      },
    });

    const cart = await prisma.cart.create({
      data: {
        customerId: customer.id,
        status: "ACTIVE",
      },
    });

    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId: product.id,
        quantity: 1,
      },
    });

    try {
      const response = await request(app)
        .post("/api/orders")
        .send({
          customerId: customer.id,
          cartId: cart.id,
        });

      expect(response.status).toBe(409);

      expect(response.body.error).toMatchObject({
        code: "INSUFFICIENT_INVENTORY",
      });

      const reservations =
        await prisma.inventoryReservation.findMany({
          where: {
            productId: product.id,
          },
        });

      expect(reservations).toHaveLength(0);

      const orders = await prisma.order.findMany({
        where: {
          customerId: customer.id,
        },
      });

      expect(orders).toHaveLength(0);
    } finally {
      await prisma.inventoryReservation.deleteMany({
        where: {
          productId: product.id,
        },
      });

      await prisma.orderItem.deleteMany({
        where: {
          productId: product.id,
        },
      });

      await prisma.cartItem.deleteMany({
        where: {
          cartId: cart.id,
        },
      });

      await prisma.cart.deleteMany({
        where: {
          id: cart.id,
        },
      });

      await prisma.inventory.deleteMany({
        where: {
          id: inventory.id,
        },
      });

      await prisma.product.deleteMany({
        where: {
          id: product.id,
        },
      });

      await prisma.customer.deleteMany({
        where: {
          id: customer.id,
        },
      });
    }
  });

  it("rolls back cancellation when inventory release fails", async () => {
    const customer = await prisma.customer.create({
      data: {
        email: `step40-cancel-rollback-${Date.now()}@example.com`,
        name: "Step 40 Cancellation Rollback Customer",
      },
    });

    const product = await prisma.product.create({
      data: {
        sku: `STEP40-CANCEL-${Date.now()}`,
        name: "Step 40 Cancellation Rollback Product",
        priceMinor: 5000,
        currency: "INR",
        active: true,
      },
    });

    const inventory = await prisma.inventory.create({
      data: {
        productId: product.id,
        quantity: 10,
        reserved: 0,
      },
    });

    const cart = await prisma.cart.create({
      data: {
        customerId: customer.id,
        status: "ACTIVE",
      },
    });

    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId: product.id,
        quantity: 1,
      },
    });

    let orderId: string | undefined;

    try {
      const createResponse = await request(app)
        .post("/api/orders")
        .send({
          customerId: customer.id,
          cartId: cart.id,
        });

      expect(createResponse.status).toBe(201);

      orderId = createResponse.body.data.id;

      expect(orderId).toBeDefined();

      const reservation =
        await prisma.inventoryReservation.findFirst({
          where: {
            orderId,
            productId: product.id,
            status: "ACTIVE",
          },
        });

      expect(reservation).not.toBeNull();

      if (!reservation) {
        throw new Error(
          "Expected an active inventory reservation.",
        );
      }

      await prisma.inventory.delete({
        where: {
          id: inventory.id,
        },
      });

      const cancelResponse = await request(app)
        .delete(`/api/orders/${orderId}`);

      expect(cancelResponse.status).toBe(404);

      expect(cancelResponse.body.error).toMatchObject({
        code: "INVENTORY_NOT_FOUND",
      });

      const order =
        await prisma.order.findUnique({
          where: {
            id: orderId,
          },
        });

      expect(order).not.toBeNull();
      expect(order?.status).toBe("CREATED");

      const reservationAfterFailure =
        await prisma.inventoryReservation.findUnique({
          where: {
            id: reservation.id,
          },
        });

      expect(reservationAfterFailure).not.toBeNull();
      expect(
        reservationAfterFailure?.status,
      ).toBe("ACTIVE");
      expect(
        reservationAfterFailure?.releasedAt,
      ).toBeNull();
    } finally {
      
      if (orderId) {
        await prisma.inventoryReservation.deleteMany({
          where: {
            orderId,
          },
        });

        await prisma.orderItem.deleteMany({
          where: {
            orderId,
          },
        });

        await prisma.order.deleteMany({
          where: {
            id: orderId,
          },
        });
      }

      await prisma.cartItem.deleteMany({
        where: {
          cartId: cart.id,
        },
      });

      await prisma.cart.deleteMany({
        where: {
          id: cart.id,
        },
      });

      await prisma.inventory.deleteMany({
        where: {
          productId: product.id,
        },
      });

      await prisma.product.deleteMany({
        where: {
          id: product.id,
        },
      });

      await prisma.customer.deleteMany({
        where: {
          id: customer.id,
        },
      });
    }
  });
});
  });

  describe("Cart / Order Consistency", () => {
  it("rejects checkout using a CONVERTED cart", async () => {
    const suffix =
      `step42-converted-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;

    const customer =
      await prisma.customer.create({
        data: {
          email:
            `${suffix}@example.com`,
          name: "Step 42 Converted Customer",
        },
      });

    const product =
      await prisma.product.create({
        data: {
          sku:
            `STEP42-CONVERTED-${suffix}`,
          name:
            "Step 42 Converted Cart Product",
          priceMinor: 1500,
          currency: "INR",
          active: true,
        },
      });

    await prisma.inventory.create({
      data: {
        productId: product.id,
        quantity: 10,
        reserved: 0,
      },
    });

    const cart =
      await prisma.cart.create({
        data: {
          customerId: customer.id,
          status: "ACTIVE",
        },
      });

    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId: product.id,
        quantity: 1,
      },
    });

    try {

      const firstResponse =
        await request(app)
          .post("/api/orders")
          .send({
            customerId: customer.id,
            cartId: cart.id,
          });

      expect(
        firstResponse.status,
      ).toBe(201);

      const convertedCart =
        await prisma.cart.findUnique({
          where: {
            id: cart.id,
          },
        });

      expect(convertedCart).not.toBeNull();

      expect(
        convertedCart?.status,
      ).toBe("CONVERTED");

      const secondResponse =
        await request(app)
          .post("/api/orders")
          .send({
            customerId: customer.id,
            cartId: cart.id,
          });

      expect(
        secondResponse.status,
      ).toBe(400);

      expect(
        secondResponse.body.error,
      ).toMatchObject({
        code: "CART_NOT_ACTIVE",
        message:
          "Cart is not active.",
      });

      const orders =
        await prisma.order.findMany({
          where: {
            customerId: customer.id,
          },
        });

      expect(orders).toHaveLength(1);
    } finally {

      const orders =
        await prisma.order.findMany({
          where: {
            customerId: customer.id,
          },
          select: {
            id: true,
          },
        });

      const orderIds =
        orders.map(
          (order) => order.id,
        );

      if (orderIds.length > 0) {
        await prisma.inventoryReservation.deleteMany({
          where: {
            orderId: {
              in: orderIds,
            },
          },
        });

        await prisma.orderItem.deleteMany({
          where: {
            orderId: {
              in: orderIds,
            },
          },
        });

        await prisma.order.deleteMany({
          where: {
            id: {
              in: orderIds,
            },
          },
        });
      }

      await prisma.cartItem.deleteMany({
        where: {
          cartId: cart.id,
        },
      });

      await prisma.cart.delete({
        where: {
          id: cart.id,
        },
      });

      await prisma.inventory.delete({
        where: {
          productId: product.id,
        },
      });

      await prisma.product.delete({
        where: {
          id: product.id,
        },
      });

      await prisma.customer.delete({
        where: {
          id: customer.id,
        },
      });
    }
  });

  it("snapshots the product price into the order item", async () => {
    const suffix =
      `step42-price-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;

    const customer =
      await prisma.customer.create({
        data: {
          email:
            `${suffix}@example.com`,
          name: "Step 42 Price Customer",
        },
      });

    const product =
      await prisma.product.create({
        data: {
          sku:
            `STEP42-PRICE-${suffix}`,
          name:
            "Step 42 Price Product",
          priceMinor: 1500,
          currency: "INR",
          active: true,
        },
      });

    await prisma.inventory.create({
      data: {
        productId: product.id,
        quantity: 10,
        reserved: 0,
      },
    });

    const cart =
      await prisma.cart.create({
        data: {
          customerId: customer.id,
          status: "ACTIVE",
        },
      });

    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId: product.id,
        quantity: 1,
      },
    });

    try {
      
      const createResponse =
        await request(app)
          .post("/api/orders")
          .send({
            customerId: customer.id,
            cartId: cart.id,
          });

      expect(
        createResponse.status,
      ).toBe(201);

      const orderId =
        createResponse.body.data.id;

      expect(orderId).toBeDefined();

      const orderItemBeforeChange =
        await prisma.orderItem.findFirst({
          where: {
            orderId,
          },
        });

      expect(
        orderItemBeforeChange,
      ).not.toBeNull();

      expect(
        orderItemBeforeChange?.unitPriceMinor,
      ).toBe(1500);

      expect(
        orderItemBeforeChange?.totalMinor,
      ).toBe(1500);

      await prisma.product.update({
        where: {
          id: product.id,
        },
        data: {
          priceMinor: 2000,
        },
      });

      const orderItemAfterChange =
        await prisma.orderItem.findFirst({
          where: {
            orderId,
          },
        });

      expect(
        orderItemAfterChange,
      ).not.toBeNull();

      expect(
        orderItemAfterChange?.unitPriceMinor,
      ).toBe(1500);

      expect(
        orderItemAfterChange?.totalMinor,
      ).toBe(1500);

      const updatedProduct =
        await prisma.product.findUnique({
          where: {
            id: product.id,
          },
        });

      expect(
        updatedProduct?.priceMinor,
      ).toBe(2000);
    } finally {
  
      const orders =
        await prisma.order.findMany({
          where: {
            customerId: customer.id,
          },
          select: {
            id: true,
          },
        });

      const orderIds =
        orders.map(
          (order) => order.id,
        );

      if (orderIds.length > 0) {
        await prisma.inventoryReservation.deleteMany({
          where: {
            orderId: {
              in: orderIds,
            },
          },
        });

        await prisma.orderItem.deleteMany({
          where: {
            orderId: {
              in: orderIds,
            },
          },
        });

        await prisma.order.deleteMany({
          where: {
            id: {
              in: orderIds,
            },
          },
        });
      }

      await prisma.cartItem.deleteMany({
        where: {
          cartId: cart.id,
        },
      });

      await prisma.cart.delete({
        where: {
          id: cart.id,
        },
      });

      await prisma.inventory.delete({
        where: {
          productId: product.id,
        },
      });

      await prisma.product.delete({
        where: {
          id: product.id,
        },
      });

      await prisma.customer.delete({
        where: {
          id: customer.id,
        },
      });
    }
  });
});

describe("Commerce E2E Baseline", () => {
  it("completes the full non-payment commerce journey", async () => {
    const suffix =
      `step43-success-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;

    const customer =
      await prisma.customer.create({
        data: {
          email:
            `${suffix}@example.com`,
          name: "Step 43 E2E Customer",
        },
      });

    const product =
      await prisma.product.create({
        data: {
          sku:
            `STEP43-SUCCESS-${suffix}`,
          name:
            "Step 43 E2E Product",
          priceMinor: 2500,
          currency: "INR",
          active: true,
        },
      });

    const inventory =
      await prisma.inventory.create({
        data: {
          productId: product.id,
          quantity: 10,
          reserved: 0,
        },
      });

    const cart =
      await prisma.cart.create({
        data: {
          customerId: customer.id,
          status: "ACTIVE",
        },
      });

    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId: product.id,
        quantity: 2,
      },
    });

    try {
    
      const createResponse =
        await request(app)
          .post("/api/orders")
          .send({
            customerId: customer.id,
            cartId: cart.id,
          });

      expect(
        createResponse.status,
      ).toBe(201);

      const order =
        createResponse.body.data;

      expect(order).toBeDefined();
      expect(order.id).toBeDefined();
      expect(order.customerId).toBe(
        customer.id,
      );
      expect(order.status).toBe(
        "CREATED",
      );
      expect(order.currency).toBe("INR");
      expect(order.subtotalMinor).toBe(
        5000,
      );
      expect(order.totalMinor).toBe(
        5000,
      );

      expect(order.items).toHaveLength(1);

      const orderItem =
        order.items[0];

      if (!orderItem) {
        throw new Error(
          "Expected an order item.",
        );
      }

      expect(
        orderItem.productId,
      ).toBe(product.id);

      expect(
        orderItem.quantity,
      ).toBe(2);

      expect(
        orderItem.unitPriceMinor,
      ).toBe(2500);

      expect(
        orderItem.totalMinor,
      ).toBe(5000);

      const updatedInventory =
        await prisma.inventory.findUnique({
          where: {
            productId: product.id,
          },
        });

      expect(
        updatedInventory,
      ).not.toBeNull();

      expect(
        updatedInventory?.quantity,
      ).toBe(10);

      expect(
        updatedInventory?.reserved,
      ).toBe(2);

      expect(
        updatedInventory
          ? updatedInventory.quantity -
              updatedInventory.reserved
          : null,
      ).toBe(8);

      const reservations =
        await prisma.inventoryReservation.findMany({
          where: {
            orderId: order.id,
          },
        });

      expect(
        reservations,
      ).toHaveLength(1);

      const reservation =
        reservations[0];

      if (!reservation) {
        throw new Error(
          "Expected an inventory reservation.",
        );
      }

      expect(
        reservation.productId,
      ).toBe(product.id);

      expect(
        reservation.quantity,
      ).toBe(2);

      expect(
        reservation.status,
      ).toBe("ACTIVE");

      expect(
        reservation.releasedAt,
      ).toBeNull();

      const convertedCart =
        await prisma.cart.findUnique({
          where: {
            id: cart.id,
          },
        });

      expect(
        convertedCart,
      ).not.toBeNull();

      expect(
        convertedCart?.status,
      ).toBe("CONVERTED");

      /*
       * 6. Retrieve the order through API.
       */
      const getResponse =
        await request(app)
          .get(
            `/api/orders/${order.id}`,
          );

      expect(
        getResponse.status,
      ).toBe(200);

      expect(
        getResponse.body.data.id,
      ).toBe(order.id);

      expect(
        getResponse.body.data.orderNumber,
      ).toBe(order.orderNumber);

      expect(
        getResponse.body.data.customerId,
      ).toBe(customer.id);

      expect(
        getResponse.body.data.status,
      ).toBe("CREATED");

      expect(
        getResponse.body.data.items,
      ).toHaveLength(1);

      expect(
        getResponse.body.data.items[0]
          .quantity,
      ).toBe(2);
    } finally {
      const orders =
        await prisma.order.findMany({
          where: {
            customerId: customer.id,
          },
          select: {
            id: true,
          },
        });

      const orderIds =
        orders.map(
          (item) => item.id,
        );

      if (orderIds.length > 0) {
        await prisma.inventoryReservation.deleteMany({
          where: {
            orderId: {
              in: orderIds,
            },
          },
        });

        await prisma.orderItem.deleteMany({
          where: {
            orderId: {
              in: orderIds,
            },
          },
        });

        await prisma.order.deleteMany({
          where: {
            id: {
              in: orderIds,
            },
          },
        });
      }

      await prisma.cartItem.deleteMany({
        where: {
          cartId: cart.id,
        },
      });

      await prisma.cart.delete({
        where: {
          id: cart.id,
        },
      });

      await prisma.inventory.delete({
        where: {
          id: inventory.id,
        },
      });

      await prisma.product.delete({
        where: {
          id: product.id,
        },
      });

      await prisma.customer.delete({
        where: {
          id: customer.id,
        },
      });
    }
  });

  it("rolls back the complete checkout when inventory is unavailable", async () => {
    const suffix =
      `step43-failure-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;

    const customer =
      await prisma.customer.create({
        data: {
          email:
            `${suffix}@example.com`,
          name: "Step 43 Failure Customer",
        },
      });

    const product =
      await prisma.product.create({
        data: {
          sku:
            `STEP43-FAILURE-${suffix}`,
          name:
            "Step 43 Out Of Stock Product",
          priceMinor: 3000,
          currency: "INR",
          active: true,
        },
      });

    const inventory =
      await prisma.inventory.create({
        data: {
          productId: product.id,
          quantity: 0,
          reserved: 0,
        },
      });

    const cart =
      await prisma.cart.create({
        data: {
          customerId: customer.id,
          status: "ACTIVE",
        },
      });

    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId: product.id,
        quantity: 1,
      },
    });

    try {
      const response =
        await request(app)
          .post("/api/orders")
          .send({
            customerId: customer.id,
            cartId: cart.id,
          });

      expect(
        response.status,
      ).toBe(409);

      expect(
        response.body.error,
      ).toMatchObject({
        code: "INSUFFICIENT_INVENTORY",
      });

      const orders =
        await prisma.order.findMany({
          where: {
            customerId: customer.id,
          },
        });

      expect(orders).toHaveLength(0);

      const currentCart =
        await prisma.cart.findUnique({
          where: {
            id: cart.id,
          },
        });

      expect(
        currentCart?.status,
      ).toBe("ACTIVE");

      const currentInventory =
        await prisma.inventory.findUnique({
          where: {
            id: inventory.id,
          },
        });

      expect(
        currentInventory?.quantity,
      ).toBe(0);

      expect(
        currentInventory?.reserved,
      ).toBe(0);

      const reservations =
        await prisma.inventoryReservation.findMany({
          where: {
            productId: product.id,
          },
        });

      expect(
        reservations,
      ).toHaveLength(0);
    } finally {
      await prisma.cartItem.deleteMany({
        where: {
          cartId: cart.id,
        },
      });

      await prisma.cart.delete({
        where: {
          id: cart.id,
        },
      });

      await prisma.inventory.delete({
        where: {
          id: inventory.id,
        },
      });

      await prisma.product.delete({
        where: {
          id: product.id,
        },
      });

      await prisma.customer.delete({
        where: {
          id: customer.id,
        },
      });
    }
  });

  it("completes the full idempotent checkout flow", async () => {
    const suffix =
      `step43-idempotency-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;

    const customer =
      await prisma.customer.create({
        data: {
          email:
            `${suffix}@example.com`,
          name: "Step 43 Idempotency Customer",
        },
      });

    const product =
      await prisma.product.create({
        data: {
          sku:
            `STEP43-IDEMPOTENCY-${suffix}`,
          name:
            "Step 43 Idempotency Product",
          priceMinor: 4000,
          currency: "INR",
          active: true,
        },
      });

    const inventory =
      await prisma.inventory.create({
        data: {
          productId: product.id,
          quantity: 10,
          reserved: 0,
        },
      });

    const cart =
      await prisma.cart.create({
        data: {
          customerId: customer.id,
          status: "ACTIVE",
        },
      });

    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId: product.id,
        quantity: 1,
      },
    });

    const idempotencyKey =
      `step43-${suffix}`;

    try {
   
      const firstResponse =
        await request(app)
          .post("/api/orders")
          .set(
            "Idempotency-Key",
            idempotencyKey,
          )
          .send({
            customerId: customer.id,
            cartId: cart.id,
          });

      expect(
        firstResponse.status,
      ).toBe(201);

      const firstOrder =
        firstResponse.body.data;

      expect(
        firstOrder.id,
      ).toBeDefined();

      const secondResponse =
        await request(app)
          .post("/api/orders")
          .set(
            "Idempotency-Key",
            idempotencyKey,
          )
          .send({
            customerId: customer.id,
            cartId: cart.id,
          });

      expect(
        secondResponse.status,
      ).toBe(201);

      expect(
        secondResponse.body.data.id,
      ).toBe(firstOrder.id);

      expect(
        secondResponse.body.data.orderNumber,
      ).toBe(firstOrder.orderNumber);

      const orders =
        await prisma.order.findMany({
          where: {
            customerId: customer.id,
          },
        });

      expect(
        orders,
      ).toHaveLength(1);

      const currentInventory =
        await prisma.inventory.findUnique({
          where: {
            id: inventory.id,
          },
        });

      expect(
        currentInventory?.reserved,
      ).toBe(1);

    
      const secondCart =
        await prisma.cart.create({
          data: {
            customerId: customer.id,
            status: "ACTIVE",
          },
        });

      try {
        const differentPayloadResponse =
          await request(app)
            .post("/api/orders")
            .set(
              "Idempotency-Key",
              idempotencyKey,
            )
            .send({
              customerId: customer.id,
              cartId: secondCart.id,
            });

        expect(
          differentPayloadResponse.status,
        ).toBe(409);

        expect(
          differentPayloadResponse.body.error,
        ).toMatchObject({
          code:
            "IDEMPOTENCY_KEY_REUSED",
        });
      } finally {
        await prisma.cart.delete({
          where: {
            id: secondCart.id,
          },
        });
      }
    } finally {
      const orders =
        await prisma.order.findMany({
          where: {
            customerId: customer.id,
          },
          select: {
            id: true,
          },
        });

      const orderIds =
        orders.map(
          (item) => item.id,
        );

      if (orderIds.length > 0) {
        await prisma.inventoryReservation.deleteMany({
          where: {
            orderId: {
              in: orderIds,
            },
          },
        });

        await prisma.orderItem.deleteMany({
          where: {
            orderId: {
              in: orderIds,
            },
          },
        });

        await prisma.order.deleteMany({
          where: {
            id: {
              in: orderIds,
            },
          },
        });
      }

      await prisma.cartItem.deleteMany({
        where: {
          cartId: cart.id,
        },
      });

      await prisma.cart.delete({
        where: {
          id: cart.id,
        },
      });

      await prisma.inventory.delete({
        where: {
          id: inventory.id,
        },
      });

      await prisma.product.delete({
        where: {
          id: product.id,
        },
      });

      await prisma.customer.delete({
        where: {
          id: customer.id,
        },
      });
    }
  });

  it("allows only one concurrent checkout when inventory is 1", async () => {
    const suffix =
      `step43-concurrency-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;

    const customerA =
      await prisma.customer.create({
        data: {
          email:
            `${suffix}-a@example.com`,
          name: "Step 43 Customer A",
        },
      });

    const customerB =
      await prisma.customer.create({
        data: {
          email:
            `${suffix}-b@example.com`,
          name: "Step 43 Customer B",
        },
      });

    const product =
      await prisma.product.create({
        data: {
          sku:
            `STEP43-CONCURRENCY-${suffix}`,
          name:
            "Step 43 Concurrent Product",
          priceMinor: 5000,
          currency: "INR",
          active: true,
        },
      });

    const inventory =
      await prisma.inventory.create({
        data: {
          productId: product.id,
          quantity: 1,
          reserved: 0,
        },
      });

    const cartA =
      await prisma.cart.create({
        data: {
          customerId: customerA.id,
          status: "ACTIVE",
        },
      });

    const cartB =
      await prisma.cart.create({
        data: {
          customerId: customerB.id,
          status: "ACTIVE",
        },
      });

    await prisma.cartItem.create({
      data: {
        cartId: cartA.id,
        productId: product.id,
        quantity: 1,
      },
    });

    await prisma.cartItem.create({
      data: {
        cartId: cartB.id,
        productId: product.id,
        quantity: 1,
      },
    });

    try {

      const [
        responseA,
        responseB,
      ] = await Promise.all([
        request(app)
          .post("/api/orders")
          .send({
            customerId:
              customerA.id,
            cartId: cartA.id,
          }),

        request(app)
          .post("/api/orders")
          .send({
            customerId:
              customerB.id,
            cartId: cartB.id,
          }),
      ]);

      const statuses = [
        responseA.status,
        responseB.status,
      ].sort(
        (a, b) => a - b,
      );


      expect(statuses).toEqual([
        201,
        409,
      ]);

      const successfulResponses = [
        responseA,
        responseB,
      ].filter(
        (response) =>
          response.status === 201,
      );

      const failedResponses = [
        responseA,
        responseB,
      ].filter(
        (response) =>
          response.status === 409,
      );

      expect(
        successfulResponses,
      ).toHaveLength(1);

      expect(
        failedResponses,
      ).toHaveLength(1);

      expect(
        failedResponses[0]?.body.error,
      ).toMatchObject({
        code:
          "INSUFFICIENT_INVENTORY",
      });

      const orders =
        await prisma.order.findMany({
          where: {
            customerId: {
              in: [
                customerA.id,
                customerB.id,
              ],
            },
          },
        });

      expect(
        orders,
      ).toHaveLength(1);

      const currentInventory =
        await prisma.inventory.findUnique({
          where: {
            id: inventory.id,
          },
        });

      expect(
        currentInventory?.quantity,
      ).toBe(1);

      expect(
        currentInventory?.reserved,
      ).toBe(1);

      expect(
        currentInventory
          ? currentInventory.quantity -
              currentInventory.reserved
          : null,
      ).toBe(0);

      /*
       * Exactly one ACTIVE reservation.
       */
      const reservations =
        await prisma.inventoryReservation.findMany({
          where: {
            productId: product.id,
            status: "ACTIVE",
          },
        });

      expect(
        reservations,
      ).toHaveLength(1);

      expect(
        reservations[0]?.quantity,
      ).toBe(1);
    } finally {
      const orders =
        await prisma.order.findMany({
          where: {
            customerId: {
              in: [
                customerA.id,
                customerB.id,
              ],
            },
          },
          select: {
            id: true,
          },
        });

      const orderIds =
        orders.map(
          (item) => item.id,
        );

      if (orderIds.length > 0) {
        await prisma.inventoryReservation.deleteMany({
          where: {
            orderId: {
              in: orderIds,
            },
          },
        });

        await prisma.orderItem.deleteMany({
          where: {
            orderId: {
              in: orderIds,
            },
          },
        });

        await prisma.order.deleteMany({
          where: {
            id: {
              in: orderIds,
            },
          },
        });
      }

      await prisma.cartItem.deleteMany({
        where: {
          cartId: {
            in: [
              cartA.id,
              cartB.id,
            ],
          },
        },
      });

      await prisma.cart.deleteMany({
        where: {
          id: {
            in: [
              cartA.id,
              cartB.id,
            ],
          },
        },
      });

      await prisma.inventory.delete({
        where: {
          id: inventory.id,
        },
      });

      await prisma.product.delete({
        where: {
          id: product.id,
        },
      });

      await prisma.customer.deleteMany({
        where: {
          id: {
            in: [
              customerA.id,
              customerB.id,
            ],
          },
        },
      });
    }
  });
});

describe("Payment Domain Model", () => {
  it("creates a payment for an order", async () => {
    const suffix = `step44-payment-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    const customer = await prisma.customer.create({
      data: {
        email: `${suffix}@example.com`,
        name: "Step 44 Payment Customer",
      },
    });

    const order = await prisma.order.create({
      data: {
        orderNumber: `STEP44-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}`,
        customerId: customer.id,
        status: "CREATED",
        currency: "INR",
        subtotalMinor: 5000,
        totalMinor: 5000,
      },
    });

    try {
      const payment = await prisma.payment.create({
        data: {
          orderId: order.id,
          provider: "RAZORPAY",
          amountMinor: 5000,
          currency: "INR",
          status: "CREATED",
        },
      });

      expect(payment.id).toBeDefined();
      expect(payment.orderId).toBe(order.id);
      expect(payment.provider).toBe("RAZORPAY");
      expect(payment.amountMinor).toBe(5000);
      expect(payment.currency).toBe("INR");
      expect(payment.status).toBe("CREATED");
      expect(payment.providerOrderId).toBeNull();
      expect(payment.providerPaymentId).toBeNull();
    } finally {
      await prisma.payment.deleteMany({
        where: {
          orderId: order.id,
        },
      });

      await prisma.order.delete({
        where: {
          id: order.id,
        },
      });

      await prisma.customer.delete({
        where: {
          id: customer.id,
        },
      });
    }
  });

  it("stores payment amounts using integer minor units", async () => {
    const suffix = `step44-money-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    const customer = await prisma.customer.create({
      data: {
        email: `${suffix}@example.com`,
      },
    });

    const order = await prisma.order.create({
      data: {
        orderNumber: `STEP44-MONEY-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}`,
        customerId: customer.id,
        currency: "INR",
        subtotalMinor: 6949800,
        totalMinor: 6949800,
      },
    });

    try {
      const payment = await prisma.payment.create({
        data: {
          orderId: order.id,
          provider: "RAZORPAY",
          amountMinor: 6949800,
          currency: "INR",
        },
      });

      expect(payment.amountMinor).toBe(6949800);

      expect(
        Number.isInteger(payment.amountMinor),
      ).toBe(true);
    } finally {
      await prisma.payment.deleteMany({
        where: {
          orderId: order.id,
        },
      });

      await prisma.order.delete({
        where: {
          id: order.id,
        },
      });

      await prisma.customer.delete({
        where: {
          id: customer.id,
        },
      });
    }
  });

  it("stores provider and provider order information", async () => {
    const suffix = `step44-provider-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    const customer = await prisma.customer.create({
      data: {
        email: `${suffix}@example.com`,
      },
    });

    const order = await prisma.order.create({
      data: {
        orderNumber: `STEP44-PROVIDER-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}`,
        customerId: customer.id,
        currency: "INR",
        subtotalMinor: 2500,
        totalMinor: 2500,
      },
    });

    try {
      const payment = await prisma.payment.create({
        data: {
          orderId: order.id,
          provider: "RAZORPAY",
          providerOrderId: "order_TEST_STEP44_001",
          amountMinor: 2500,
          currency: "INR",
        },
      });

      expect(
        payment.provider,
      ).toBe("RAZORPAY");

      expect(
        payment.providerOrderId,
      ).toBe("order_TEST_STEP44_001");
    } finally {
      await prisma.payment.deleteMany({
        where: {
          orderId: order.id,
        },
      });

      await prisma.order.delete({
        where: {
          id: order.id,
        },
      });

      await prisma.customer.delete({
        where: {
          id: customer.id,
        },
      });
    }
  });

  it("creates multiple payment attempts for one payment", async () => {
    const suffix = `step44-attempts-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    const customer = await prisma.customer.create({
      data: {
        email: `${suffix}@example.com`,
      },
    });

    const order = await prisma.order.create({
      data: {
        orderNumber: `STEP44-ATTEMPTS-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}`,
        customerId: customer.id,
        currency: "INR",
        subtotalMinor: 5000,
        totalMinor: 5000,
      },
    });

    try {
      const payment = await prisma.payment.create({
        data: {
          orderId: order.id,
          provider: "RAZORPAY",
          amountMinor: 5000,
          currency: "INR",
        },
      });

      const attempt1 =
        await prisma.paymentAttempt.create({
          data: {
            paymentId: payment.id,
            attemptNumber: 1,
            status: "FAILED",
            providerReference:
              "attempt_ref_001",
            failureCode:
              "PAYMENT_TIMEOUT",
            failureMessage:
              "Payment provider timed out.",
          },
        });

      const attempt2 =
        await prisma.paymentAttempt.create({
          data: {
            paymentId: payment.id,
            attemptNumber: 2,
            status: "SUCCESS",
            providerReference:
              "attempt_ref_002",
          },
        });

      expect(
        attempt1.paymentId,
      ).toBe(payment.id);

      expect(
        attempt1.attemptNumber,
      ).toBe(1);

      expect(
        attempt1.status,
      ).toBe("FAILED");

      expect(
        attempt2.paymentId,
      ).toBe(payment.id);

      expect(
        attempt2.attemptNumber,
      ).toBe(2);

      expect(
        attempt2.status,
      ).toBe("SUCCESS");

      const attempts =
        await prisma.paymentAttempt.findMany({
          where: {
            paymentId: payment.id,
          },
          orderBy: {
            attemptNumber: "asc",
          },
        });

      expect(
        attempts,
      ).toHaveLength(2);

      expect(
        attempts[0]?.attemptNumber,
      ).toBe(1);

      expect(
        attempts[1]?.attemptNumber,
      ).toBe(2);
    } finally {
      const payments =
        await prisma.payment.findMany({
          where: {
            orderId: order.id,
          },
          select: {
            id: true,
          },
        });

      const paymentIds =
        payments.map(
          (payment) => payment.id,
        );

      if (paymentIds.length > 0) {
        await prisma.paymentAttempt.deleteMany({
          where: {
            paymentId: {
              in: paymentIds,
            },
          },
        });

        await prisma.payment.deleteMany({
          where: {
            id: {
              in: paymentIds,
            },
          },
        });
      }

      await prisma.order.delete({
        where: {
          id: order.id,
        },
      });

      await prisma.customer.delete({
        where: {
          id: customer.id,
        },
      });
    }
  });

  it("allows attempt number 1 for different payments", async () => {
    const suffix = `step44-independent-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    const customer = await prisma.customer.create({
      data: {
        email: `${suffix}@example.com`,
      },
    });

    const order = await prisma.order.create({
      data: {
        orderNumber: `STEP44-INDEPENDENT-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}`,
        customerId: customer.id,
        currency: "INR",
        subtotalMinor: 10000,
        totalMinor: 10000,
      },
    });

    try {
      const payment1 =
        await prisma.payment.create({
          data: {
            orderId: order.id,
            provider: "RAZORPAY",
            amountMinor: 5000,
            currency: "INR",
          },
        });

      const payment2 =
        await prisma.payment.create({
          data: {
            orderId: order.id,
            provider: "RAZORPAY",
            amountMinor: 5000,
            currency: "INR",
          },
        });

      const attempt1 =
        await prisma.paymentAttempt.create({
          data: {
            paymentId: payment1.id,
            attemptNumber: 1,
          },
        });

      const attempt2 =
        await prisma.paymentAttempt.create({
          data: {
            paymentId: payment2.id,
            attemptNumber: 1,
          },
        });

      expect(
        attempt1.attemptNumber,
      ).toBe(1);

      expect(
        attempt2.attemptNumber,
      ).toBe(1);

      expect(
        attempt1.paymentId,
      ).not.toBe(attempt2.paymentId);
    } finally {
      const payments =
        await prisma.payment.findMany({
          where: {
            orderId: order.id,
          },
          select: {
            id: true,
          },
        });

      const paymentIds =
        payments.map(
          (payment) => payment.id,
        );

      if (paymentIds.length > 0) {
        await prisma.paymentAttempt.deleteMany({
          where: {
            paymentId: {
              in: paymentIds,
            },
          },
        });

        await prisma.payment.deleteMany({
          where: {
            id: {
              in: paymentIds,
            },
          },
        });
      }

      await prisma.order.delete({
        where: {
          id: order.id,
        },
      });

      await prisma.customer.delete({
        where: {
          id: customer.id,
        },
      });
    }
  });

  it("enforces unique attempt numbers within a payment", async () => {
    const suffix = `step44-unique-attempt-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    const customer = await prisma.customer.create({
      data: {
        email: `${suffix}@example.com`,
      },
    });

    const order = await prisma.order.create({
      data: {
        orderNumber: `STEP44-UNIQUE-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}`,
        customerId: customer.id,
        currency: "INR",
        subtotalMinor: 5000,
        totalMinor: 5000,
      },
    });

    try {
      const payment =
        await prisma.payment.create({
          data: {
            orderId: order.id,
            provider: "RAZORPAY",
            amountMinor: 5000,
            currency: "INR",
          },
        });

      await prisma.paymentAttempt.create({
        data: {
          paymentId: payment.id,
          attemptNumber: 1,
        },
      });

      await expect(
        prisma.paymentAttempt.create({
          data: {
            paymentId: payment.id,
            attemptNumber: 1,
          },
        }),
      ).rejects.toMatchObject({
        code: "P2002",
      });
    } finally {
      const payments =
        await prisma.payment.findMany({
          where: {
            orderId: order.id,
          },
          select: {
            id: true,
          },
        });

      const paymentIds =
        payments.map(
          (payment) => payment.id,
        );

      if (paymentIds.length > 0) {
        await prisma.paymentAttempt.deleteMany({
          where: {
            paymentId: {
              in: paymentIds,
            },
          },
        });

        await prisma.payment.deleteMany({
          where: {
            id: {
              in: paymentIds,
            },
          },
        });
      }

      await prisma.order.delete({
        where: {
          id: order.id,
        },
      });

      await prisma.customer.delete({
        where: {
          id: customer.id,
        },
      });
    }
  });

  it("stores payment attempt failure information", async () => {
    const suffix = `step44-failure-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    const customer = await prisma.customer.create({
      data: {
        email: `${suffix}@example.com`,
      },
    });

    const order = await prisma.order.create({
      data: {
        orderNumber: `STEP44-FAILURE-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}`,
        customerId: customer.id,
        currency: "INR",
        subtotalMinor: 3000,
        totalMinor: 3000,
      },
    });

    try {
      const payment =
        await prisma.payment.create({
          data: {
            orderId: order.id,
            provider: "RAZORPAY",
            amountMinor: 3000,
            currency: "INR",
          },
        });

      const attempt =
        await prisma.paymentAttempt.create({
          data: {
            paymentId: payment.id,
            attemptNumber: 1,
            status: "FAILED",
            providerReference:
              "pay_failure_001",
            failureCode:
              "CARD_DECLINED",
            failureMessage:
              "The card was declined.",
          },
        });

      expect(
        attempt.status,
      ).toBe("FAILED");

      expect(
        attempt.providerReference,
      ).toBe("pay_failure_001");

      expect(
        attempt.failureCode,
      ).toBe("CARD_DECLINED");

      expect(
        attempt.failureMessage,
      ).toBe(
        "The card was declined.",
      );
    } finally {
      const payments =
        await prisma.payment.findMany({
          where: {
            orderId: order.id,
          },
          select: {
            id: true,
          },
        });

      const paymentIds =
        payments.map(
          (payment) => payment.id,
        );

      if (paymentIds.length > 0) {
        await prisma.paymentAttempt.deleteMany({
          where: {
            paymentId: {
              in: paymentIds,
            },
          },
        });

        await prisma.payment.deleteMany({
          where: {
            id: {
              in: paymentIds,
            },
          },
        });
      }

      await prisma.order.delete({
        where: {
          id: order.id,
        },
      });

      await prisma.customer.delete({
        where: {
          id: customer.id,
        },
      });
    }
  });

  it("loads payment attempts through the payment relation", async () => {
    const suffix = `step44-relation-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    const customer = await prisma.customer.create({
      data: {
        email: `${suffix}@example.com`,
      },
    });

    const order = await prisma.order.create({
      data: {
        orderNumber: `STEP44-RELATION-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}`,
        customerId: customer.id,
        currency: "INR",
        subtotalMinor: 7500,
        totalMinor: 7500,
      },
    });

    try {
      const payment =
        await prisma.payment.create({
          data: {
            orderId: order.id,
            provider: "RAZORPAY",
            amountMinor: 7500,
            currency: "INR",
          },
        });

      await prisma.paymentAttempt.create({
        data: {
          paymentId: payment.id,
          attemptNumber: 1,
          status: "FAILED",
        },
      });

      await prisma.paymentAttempt.create({
        data: {
          paymentId: payment.id,
          attemptNumber: 2,
          status: "SUCCESS",
        },
      });

      const paymentWithAttempts =
        await prisma.payment.findUnique({
          where: {
            id: payment.id,
          },
          include: {
            attempts: {
              orderBy: {
                attemptNumber: "asc",
              },
            },
          },
        });

      expect(
        paymentWithAttempts,
      ).not.toBeNull();

      expect(
        paymentWithAttempts?.attempts,
      ).toHaveLength(2);

      expect(
        paymentWithAttempts
          ?.attempts[0]
          ?.attemptNumber,
      ).toBe(1);

      expect(
        paymentWithAttempts
          ?.attempts[1]
          ?.attemptNumber,
      ).toBe(2);
    } finally {
      const payments =
        await prisma.payment.findMany({
          where: {
            orderId: order.id,
          },
          select: {
            id: true,
          },
        });

      const paymentIds =
        payments.map(
          (payment) => payment.id,
        );

      if (paymentIds.length > 0) {
        await prisma.paymentAttempt.deleteMany({
          where: {
            paymentId: {
              in: paymentIds,
            },
          },
        });

        await prisma.payment.deleteMany({
          where: {
            id: {
              in: paymentIds,
            },
          },
        });
      }

      await prisma.order.delete({
        where: {
          id: order.id,
        },
      });

      await prisma.customer.delete({
        where: {
          id: customer.id,
        },
      });
    }
  });

  it("stores provider payment IDs when available", async () => {
    const suffix = `step44-provider-payment-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    const customer = await prisma.customer.create({
      data: {
        email: `${suffix}@example.com`,
      },
    });

    const order = await prisma.order.create({
      data: {
        orderNumber: `STEP44-PAYMENT-ID-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}`,
        customerId: customer.id,
        currency: "INR",
        subtotalMinor: 4500,
        totalMinor: 4500,
      },
    });

    try {
      const payment =
        await prisma.payment.create({
          data: {
            orderId: order.id,
            provider: "RAZORPAY",
            providerOrderId:
              "order_STEP44_002",
            providerPaymentId:
              "pay_STEP44_002",
            amountMinor: 4500,
            currency: "INR",
            status: "SUCCESS",
          },
        });

      expect(
        payment.providerOrderId,
      ).toBe("order_STEP44_002");

      expect(
        payment.providerPaymentId,
      ).toBe("pay_STEP44_002");

      expect(
        payment.status,
      ).toBe("SUCCESS");
    } finally {
      await prisma.payment.deleteMany({
        where: {
          orderId: order.id,
        },
      });

      await prisma.order.delete({
        where: {
          id: order.id,
        },
      });

      await prisma.customer.delete({
        where: {
          id: customer.id,
        },
      });
    }
  });

  it("prevents deleting a payment while payment attempts exist", async () => {
    const suffix = `step44-protect-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    const customer = await prisma.customer.create({
      data: {
        email: `${suffix}@example.com`,
      },
    });

    const order = await prisma.order.create({
      data: {
        orderNumber: `STEP44-PROTECT-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}`,
        customerId: customer.id,
        currency: "INR",
        subtotalMinor: 6000,
        totalMinor: 6000,
      },
    });

    try {
      const payment =
        await prisma.payment.create({
          data: {
            orderId: order.id,
            provider: "RAZORPAY",
            amountMinor: 6000,
            currency: "INR",
          },
        });

      await prisma.paymentAttempt.create({
        data: {
          paymentId: payment.id,
          attemptNumber: 1,
          status: "FAILED",
        },
      });

      await expect(
        prisma.payment.delete({
          where: {
            id: payment.id,
          },
        }),
      ).rejects.toMatchObject({
        code: "P2003",
      });

      const existingPayment =
        await prisma.payment.findUnique({
          where: {
            id: payment.id,
          },
        });

      expect(
        existingPayment,
      ).not.toBeNull();
    } finally {
      const payments =
        await prisma.payment.findMany({
          where: {
            orderId: order.id,
          },
          select: {
            id: true,
          },
        });

      const paymentIds =
        payments.map(
          (payment) => payment.id,
        );

      if (paymentIds.length > 0) {
        await prisma.paymentAttempt.deleteMany({
          where: {
            paymentId: {
              in: paymentIds,
            },
          },
        });

        await prisma.payment.deleteMany({
          where: {
            id: {
              in: paymentIds,
            },
          },
        });
      }

      await prisma.order.delete({
        where: {
          id: order.id,
        },
      });

      await prisma.customer.delete({
        where: {
          id: customer.id,
        },
      });
    }
  });
});

});






