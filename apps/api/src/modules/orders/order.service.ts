import {CartItemRepository,CartRepository,CustomerRepository,OrderItemRepository,OrderRepository,ProductRepository} from "@repo/database";

export class OrderService {
  constructor(
    private readonly cartRepository: CartRepository,
    private readonly customerRepository: CustomerRepository,
    private readonly orderRepository: OrderRepository,
    private readonly orderItemRepository: OrderItemRepository,
    private readonly productRepository: ProductRepository,
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
    }

    throw new Error(
      "Order creation transaction not implemented yet.",
    );
  }
}