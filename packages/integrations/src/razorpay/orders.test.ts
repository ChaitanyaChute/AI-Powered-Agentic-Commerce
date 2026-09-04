import { describe, expect, it, vi } from "vitest";

import type { RazorpayClient } from "./client.js";
import { RazorpayOrders } from "./orders.js";

describe("RazorpayOrders", () => {
  function createClient() {
    return {
      client: {
        orders: {
          create: vi.fn(),
        },
      },
    } as unknown as RazorpayClient;
  }

  it("creates a Razorpay order with the correct fields", async () => {
    const client = createClient();

    vi.mocked(
      client.client.orders.create,
    ).mockResolvedValue({
      id: "order_rzp_123",
      entity: "order",
      amount: 50000,
      amount_paid: 0,
      amount_due: 50000,
      currency: "INR",
      receipt: "receipt-123",
      status: "created",
      created_at: 1234567890,
    } as never);

    const orders = new RazorpayOrders(client);

    const result = await orders.createOrder({
      amount: 50000,
      currency: "INR",
      receipt: "receipt-123",
      notes: {
        paymentId: "payment-123",
      },
    });

    expect(
      client.client.orders.create,
    ).toHaveBeenCalledOnce();

    expect(
      client.client.orders.create,
    ).toHaveBeenCalledWith({
      amount: 50000,
      currency: "INR",
      receipt: "receipt-123",
      notes: {
        paymentId: "payment-123",
      },
    });

    expect(result).toEqual({
      id: "order_rzp_123",
      entity: "order",
      amount: 50000,
      amount_paid: 0,
      amount_due: 50000,
      currency: "INR",
      receipt: "receipt-123",
      status: "created",
      created_at: 1234567890,
    });
  });

  it("passes the internal money representation directly to Razorpay", async () => {
    const client = createClient();

    vi.mocked(
      client.client.orders.create,
    ).mockResolvedValue({
      id: "order_RAZORPAY_123",
      entity: "order",
      amount: 50000,
      amount_paid: 0,
      amount_due: 50000,
      currency: "INR",
      receipt: "ORD-123",
      status: "created",
      created_at: 1234567890,
    } as never);

    const orders = new RazorpayOrders(client);

    const result = await orders.createOrder({
      amount: 50000,
      currency: "INR",
      receipt: "ORD-123",
    });

    expect(
      client.client.orders.create,
    ).toHaveBeenCalledWith({
      amount: 50000,
      currency: "INR",
      receipt: "ORD-123",
    });

    expect(result.amount).toBe(50000);
    expect(result.currency).toBe("INR");
    expect(result.receipt).toBe("ORD-123");
  });

  it("omits notes when notes are not provided", async () => {
    const client = createClient();

    vi.mocked(
      client.client.orders.create,
    ).mockResolvedValue({
      id: "order_rzp_456",
      entity: "order",
      amount: 25000,
      amount_paid: 0,
      amount_due: 25000,
      currency: "INR",
      receipt: "receipt-456",
      status: "created",
      created_at: 1234567890,
    } as never);

    const orders = new RazorpayOrders(client);

    await orders.createOrder({
      amount: 25000,
      currency: "INR",
      receipt: "receipt-456",
    });

    expect(
      client.client.orders.create,
    ).toHaveBeenCalledWith({
      amount: 25000,
      currency: "INR",
      receipt: "receipt-456",
    });
  });

  it("propagates Razorpay errors", async () => {
    const client = createClient();

    const error = new Error(
      "Razorpay unavailable",
    );

    vi.mocked(
      client.client.orders.create,
    ).mockRejectedValue(error);

    const orders = new RazorpayOrders(client);

    await expect(
      orders.createOrder({
        amount: 50000,
        currency: "INR",
        receipt: "receipt-error",
      }),
    ).rejects.toBe(error);
  });
});