import { withDatabaseTransaction,InventoryRepository,CartRepository,CustomerRepository,OrderItemRepository,OrderRepository,ProductRepository} from "@repo/database";
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

  async createOrderFromCart(
  customerId: string,
  cartId: string,
) {
  const customer =
    await this.customerRepository.findById(customerId);

  if (!customer) {
    throw new Error("Customer not found.");
  }

  const cart =
    await this.cartRepository.findByIdWithItems(cartId);

  if (!cart) {
    throw new Error("Cart not found.");
  }

  if (cart.customerId !== customerId) {
    throw new Error("Cart does not belong to customer.");
  }

  if (cart.status !== "ACTIVE") {
    throw new Error("Cart is not active.");
  }

  if (cart.items.length === 0) {
    throw new Error("Cannot create order from an empty cart.");
  }

  return withDatabaseTransaction(async (tx) => {
    const txCartRepository = new CartRepository(tx);
    const txInventoryRepository = new InventoryRepository(tx);
    const txOrderRepository = new OrderRepository(tx);
    const txOrderItemRepository = new OrderItemRepository(tx);

    let subtotalMinor = 0;

    const orderItems = [];

    for (const item of cart.items) {
      const product =
        await this.productRepository.findById(item.productId);

      if (!product) {
        throw new Error(
          `Product ${item.productId} no longer exists.`,
        );
      }

      if (!product.active) {
        throw new Error(
          `Product ${product.id} is no longer active.`,
        );
      }

      if (item.quantity <= 0) {
        throw new Error(
          `Invalid quantity for product ${product.id}.`,
        );
      }

      const inventory =
        await txInventoryRepository.findByProductId(
          product.id,
        );

      if (!inventory) {
        throw new Error(
          `Inventory not found for product ${product.id}.`,
        );
      }

      const availableQuantity =
        inventory.quantity - inventory.reserved;

      if (availableQuantity < item.quantity) {
        throw new Error(
          `Insufficient inventory for product ${product.id}.`,
        );
      }

      const unitPriceMinor = product.priceMinor;
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
        status: "PENDING",
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
        throw new Error(
          `Inventory not found for product ${item.productId}.`,
        );
      }

      await txInventoryRepository.reserve(
        inventory.id,
        item.quantity,
     );
    }

    await txCartRepository.update(cart.id, {
      status: "CONVERTED",
    });

    return txOrderRepository.findByIdWithItems(order.id);
  });
}
}