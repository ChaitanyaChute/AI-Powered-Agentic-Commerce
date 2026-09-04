import type {
  RazorpayClient,
} from "./client.js";

import type {
  RazorpayOrderRequest,
  RazorpayOrderResponse,
} from "./types.js";

export class RazorpayOrders {
  constructor(
    private readonly razorpayClient: RazorpayClient,
  ) {}

  async createOrder(
    input: RazorpayOrderRequest,
  ): Promise<RazorpayOrderResponse> {
    const order =
      await this.razorpayClient.client.orders.create({
        amount: input.amount,
        currency: input.currency,
        receipt: input.receipt,
        ...(input.notes
          ? { notes: input.notes }
          : {}),
      });

    return order as RazorpayOrderResponse;
  }
}