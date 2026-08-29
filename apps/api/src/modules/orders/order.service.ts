import {
  withDatabaseTransaction,
  InventoryRepository,
  CartRepository,
  CustomerRepository,
  OrderItemRepository,
  OrderRepository,
  ProductRepository,
} from "@repo/database";

import { AppError } from "../../middleware/error-handler.js";

import {
  assertValidOrderTransition,
  type OrderStatus} from "./order-state-machine.js";

import { generateOrderNumber } from "./order-number.js";

export class OrderService {
  constructor(
    private readonly cartRepository: CartRepository,
    private readonly customerRepository: CustomerRepository,
    private readonly orderRepository: OrderRepository,
    private readonly orderItemRepository: OrderItemRepository,
    private readonly productRepository: ProductRepository,
    private readonly inventoryRepository: InventoryRepository,
  ) {}

  async getOrderById(id: string) {
    return this.orderRepository.findByIdWithItems(id);
  }

  async getOrderByNumber(orderNumber: string) {
    return this.orderRepository.findByOrderNumber(orderNumber);
  }

  async listCustomerOrders(customerId: string) {
    return this.orderRepository.listByCustomerId(customerId);
  }

  async transitionOrderStatus(
    orderId: string,
    nextStatus: OrderStatus,
  ) {
    const order =
      await this.orderRepository.findByIdWithItems(
        orderId,
      );

    if (!order) {
      throw new AppError(
        "Order not found.",
        404,
        "ORDER_NOT_FOUND",
      );
    }

    assertValidOrderTransition(
      order.status as OrderStatus,
      nextStatus,
    );

    return this.orderRepository.update(
      orderId,
      {
        status: nextStatus,
      },
    );
  }

  async transitionOrder(
  orderId: string,
  nextStatus: OrderStatus,
) {
  const order =
    await this.orderRepository.findByIdWithItems(
      orderId,
    );

  if (!order) {
    throw new AppError(
      "Order not found.",
      404,
      "ORDER_NOT_FOUND",
    );
  }

  assertValidOrderTransition(
    order.status as OrderStatus,
    nextStatus,
  );

  return this.orderRepository.update(
    order.id,
    {
      status: nextStatus,
    },
  );
}

async cancelOrder(orderId: string) {
  return withDatabaseTransaction(async (tx) => {
    const txOrderRepository =
      new OrderRepository(tx);

    const txInventoryRepository =
      new InventoryRepository(tx);

    const order =
      await txOrderRepository.findByIdWithItems(
        orderId,
      );

    if (!order) {
      throw new AppError(
        "Order not found.",
        404,
        "ORDER_NOT_FOUND",
      );
    }

    // Cancellation is idempotent.
    // If the order is already cancelled, do not
    // release inventory again.
    if (order.status === "CANCELLED") {
      return order;
    }

    // Only CREATED orders can be cancelled.
    if (order.status !== "CREATED") {
      throw new AppError(
        `Cannot transition order from ${order.status} to CANCELLED.`,
        409,
        "INVALID_ORDER_STATUS_TRANSITION",
      );
    }

    // Release every inventory reservation exactly once.
    for (const item of order.items) {
      const inventory =
        await txInventoryRepository.findByProductId(
          item.productId,
        );

      if (!inventory) {
        throw new AppError(
          `Inventory not found for product ${item.productId}.`,
          404,
          "INVENTORY_NOT_FOUND",
        );
      }

      await txInventoryRepository.release(
        inventory.id,
        item.quantity,
      );
    }

    // Use the same state-machine validation used
    // everywhere else in the order lifecycle.
    assertValidOrderTransition(
      order.status as OrderStatus,
      "CANCELLED",
    );

    await txOrderRepository.update(
      order.id,
      {
        status: "CANCELLED",
      },
    );

    // IMPORTANT:
    // Return the same complete representation as
    // the already-cancelled branch.
    return txOrderRepository.findByIdWithItems(
      order.id,
    );
  });
}

  async createOrderFromCart(
    customerId: string,
    cartId: string,
  ) {
    const customer =
      await this.customerRepository.findById(customerId);

    if (!customer) {
      throw new AppError(
        "Customer not found.",
        404,
        "CUSTOMER_NOT_FOUND",
      );
    }

    const cart =
      await this.cartRepository.findByIdWithItems(cartId);

    if (!cart) {
      throw new AppError(
        "Cart not found.",
        404,
        "CART_NOT_FOUND",
      );
    }

    if (cart.customerId !== customerId) {
      throw new AppError(
        "Cart does not belong to customer.",
        403,
        "CART_CUSTOMER_MISMATCH",
      );
    }

    if (cart.status !== "ACTIVE") {
      throw new AppError(
        "Cart is not active.",
        400,
        "CART_NOT_ACTIVE",
      );
    }

    if (cart.items.length === 0) {
      throw new AppError(
        "Cannot create order from an empty cart.",
        400,
        "EMPTY_CART",
      );
    }

    return withDatabaseTransaction(async (tx) => {
      const txCartRepository = new CartRepository(tx);

      const txInventoryRepository =
        new InventoryRepository(tx);

      const txOrderRepository =
        new OrderRepository(tx);

      const txOrderItemRepository =
        new OrderItemRepository(tx);

      let subtotalMinor = 0;

      const orderItems = [];

      for (const item of cart.items) {
        const product =
          await this.productRepository.findById(
            item.productId,
          );

        if (!product) {
          throw new AppError(
            `Product ${item.productId} no longer exists.`,
            404,
            "PRODUCT_NOT_FOUND",
          );
        }

        if (!product.active) {
          throw new AppError(
            `Product ${product.id} is no longer active.`,
            400,
            "PRODUCT_NOT_ACTIVE",
          );
        }

        if (item.quantity <= 0) {
          throw new AppError(
            `Invalid quantity for product ${product.id}.`,
            400,
            "INVALID_CART_ITEM_QUANTITY",
          );
        }

        const inventory =
          await txInventoryRepository.findByProductId(
            product.id,
          );

        if (!inventory) {
          throw new AppError(
            `Inventory not found for product ${product.id}.`,
            404,
            "INVENTORY_NOT_FOUND",
          );
        }

        const availableQuantity =
          inventory.quantity - inventory.reserved;

        if (availableQuantity < item.quantity) {
          throw new AppError(
            `Insufficient inventory for product ${product.id}.`,
            409,
            "INSUFFICIENT_INVENTORY",
          );
        }

        const unitPriceMinor =
          product.priceMinor;

        const totalMinor =
          unitPriceMinor * item.quantity;

        subtotalMinor += totalMinor;

        orderItems.push({
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          unitPriceMinor,
          currency: product.currency,
          quantity: item.quantity,
          totalMinor,
        });
      }

      const order =
        await txOrderRepository.create({
          orderNumber: generateOrderNumber(),
          customer: {
            connect: {
              id: customer.id,
            },
          },

          // 35.9:
          // Every newly-created order starts
          // at the CREATED state.
          status: "CREATED",

          currency: "INR",
          subtotalMinor,
          totalMinor: subtotalMinor,
        });

      await txOrderItemRepository.createMany(
        orderItems.map((item) => ({
          orderId: order.id,
          ...item,
        })),
      );

      for (const item of cart.items) {
        const inventory =
          await txInventoryRepository.findByProductId(
            item.productId,
          );

        if (!inventory) {
          throw new AppError(
            `Inventory not found for product ${item.productId}.`,
            404,
            "INVENTORY_NOT_FOUND",
          );
        }

        await txInventoryRepository.reserve(
          inventory.id,
          item.quantity,
        );
      }

      await txCartRepository.update(
        cart.id,
        {
          status: "CONVERTED",
        },
      );

      return txOrderRepository.findByIdWithItems(
        order.id,
      );
    });
  }
}