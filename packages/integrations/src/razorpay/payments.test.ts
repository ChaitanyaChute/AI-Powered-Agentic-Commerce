import * as crypto from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import type { RazorpayClient } from "./client.js";
import { RazorpayPayments } from "./payments.js";

describe("RazorpayPayments", () => {
  function createClient() {
    return {
      client: {
        payments: {
          fetch: vi.fn(),
          capture: vi.fn(),
          refund: vi.fn(),
        },
      },
      keyId: "rzp_test_key",
      keySecret: "test_secret",
    } as unknown as RazorpayClient;
  }

  describe("fetchPayment", () => {
    it("fetches a payment by provider payment id", async () => {
      const client = createClient();

      vi.mocked(
        client.client.payments.fetch,
      ).mockResolvedValue({
        id: "pay_123",
        entity: "payment",
        amount: 50000,
        currency: "INR",
        status: "authorized",
        order_id: "order_123",
        method: "card",
        captured: false,
      } as never);

      const payments = new RazorpayPayments(client);

      const result =
        await payments.fetchPayment("pay_123");

      expect(
        client.client.payments.fetch,
      ).toHaveBeenCalledOnce();

      expect(
        client.client.payments.fetch,
      ).toHaveBeenCalledWith("pay_123");

      expect(result).toEqual({
        id: "pay_123",
        entity: "payment",
        amount: 50000,
        currency: "INR",
        status: "authorized",
        order_id: "order_123",
        method: "card",
        captured: false,
      });
    });

    it("propagates Razorpay fetch errors", async () => {
      const client = createClient();

      const error =
        new Error("Razorpay fetch failed");

      vi.mocked(
        client.client.payments.fetch,
      ).mockRejectedValue(error);

      const payments = new RazorpayPayments(client);

      await expect(
        payments.fetchPayment("pay_123"),
      ).rejects.toBe(error);
    });
  });

  describe("verifyPaymentSignature", () => {
    it("returns false for an invalid payment signature", () => {
      const client = createClient();

      const payments =
        new RazorpayPayments(client);

      const result =
        payments.verifyPaymentSignature({
          orderId: "order_123",
          paymentId: "pay_123",
          signature: "invalid-placeholder",
        });

      expect(result).toBe(false);
    });

    it("verifies payment signature using the Razorpay key secret", () => {
      const client = createClient();

      const payments =
        new RazorpayPayments(client);

      const signature =
        crypto
          .createHmac(
            "sha256",
            "test_secret",
          )
          .update("order_123|pay_123")
          .digest("hex");

      expect(
        payments.verifyPaymentSignature({
          orderId: "order_123",
          paymentId: "pay_123",
          signature,
        }),
      ).toBe(true);
    });

    it("rejects a signature generated with the wrong secret", () => {
      const client = createClient();

      const payments =
        new RazorpayPayments(client);

      const signature =
        crypto
          .createHmac(
            "sha256",
            "wrong_secret",
          )
          .update("order_123|pay_123")
          .digest("hex");

      expect(
        payments.verifyPaymentSignature({
          orderId: "order_123",
          paymentId: "pay_123",
          signature,
        }),
      ).toBe(false);
    });
  });

  describe("capturePayment", () => {
    it("captures a payment and normalizes the response", async () => {
      const client = createClient();

      vi.mocked(
        client.client.payments.capture,
      ).mockResolvedValue({
        id: "pay_123",
        order_id: "order_123",
        amount: "50000",
        currency: "INR",
        status: "captured",
      } as never);

      const payments =
        new RazorpayPayments(client);

      const result =
        await payments.capturePayment({
          paymentId: "pay_123",
          amount: 50000,
          currency: "INR",
        });

      expect(
        client.client.payments.capture,
      ).toHaveBeenCalledOnce();

      expect(
        client.client.payments.capture,
      ).toHaveBeenCalledWith(
        "pay_123",
        50000,
        "INR",
      );

      expect(result).toEqual({
        id: "pay_123",
        order_id: "order_123",
        amount: 50000,
        currency: "INR",
        status: "captured",
      });
    });

    it("accepts a numeric capture amount", async () => {
      const client = createClient();

      vi.mocked(
        client.client.payments.capture,
      ).mockResolvedValue({
        id: "pay_123",
        order_id: "order_123",
        amount: 50000,
        currency: "INR",
        status: "captured",
      } as never);

      const payments =
        new RazorpayPayments(client);

      const result =
        await payments.capturePayment({
          paymentId: "pay_123",
          amount: 50000,
          currency: "INR",
        });

      expect(result.amount).toBe(50000);
    });

    it("rejects a capture response with missing required fields", async () => {
      const client = createClient();

      vi.mocked(
        client.client.payments.capture,
      ).mockResolvedValue({
        id: "pay_123",
        order_id: "order_123",
        amount: undefined,
        currency: "INR",
        status: "captured",
      } as never);

      const payments =
        new RazorpayPayments(client);

      await expect(
        payments.capturePayment({
          paymentId: "pay_123",
          amount: 50000,
          currency: "INR",
        }),
      ).rejects.toThrow(
        "Razorpay capture response is missing required fields.",
      );
    });

    it("rejects a capture response with a non-numeric amount", async () => {
      const client = createClient();

      vi.mocked(
        client.client.payments.capture,
      ).mockResolvedValue({
        id: "pay_123",
        order_id: "order_123",
        amount: "not-a-number",
        currency: "INR",
        status: "captured",
      } as never);

      const payments =
        new RazorpayPayments(client);

      await expect(
        payments.capturePayment({
          paymentId: "pay_123",
          amount: 50000,
          currency: "INR",
        }),
      ).rejects.toThrow(
        "Razorpay capture response returned a non-numeric amount",
      );
    });

    it("propagates capture errors", async () => {
      const client = createClient();

      const error =
        new Error("Razorpay capture failed");

      vi.mocked(
        client.client.payments.capture,
      ).mockRejectedValue(error);

      const payments =
        new RazorpayPayments(client);

      await expect(
        payments.capturePayment({
          paymentId: "pay_123",
          amount: 50000,
          currency: "INR",
        }),
      ).rejects.toBe(error);
    });
  });

  describe("refundPayment", () => {
    it("refunds a payment with amount and notes", async () => {
      const client = createClient();

      vi.mocked(
        client.client.payments.refund,
      ).mockResolvedValue({
        id: "rfnd_123",
        payment_id: "pay_123",
        amount: "25000",
        currency: "INR",
        status: "processed",
      } as never);

      const payments =
        new RazorpayPayments(client);

      const result =
        await payments.refundPayment({
          paymentId: "pay_123",
          amount: 25000,
          notes: {
            reason: "customer_request",
          },
        });

      expect(
        client.client.payments.refund,
      ).toHaveBeenCalledOnce();

      expect(
        client.client.payments.refund,
      ).toHaveBeenCalledWith(
        "pay_123",
        {
          amount: 25000,
          notes: {
            reason: "customer_request",
          },
        },
      );

      expect(result).toEqual({
        id: "rfnd_123",
        payment_id: "pay_123",
        amount: 25000,
        currency: "INR",
        status: "processed",
      });
    });

    it("refunds the full payment when amount is omitted", async () => {
      const client = createClient();

      vi.mocked(
        client.client.payments.refund,
      ).mockResolvedValue({
        id: "rfnd_456",
        payment_id: "pay_123",
        amount: 50000,
        currency: "INR",
        status: "processed",
      } as never);

      const payments =
        new RazorpayPayments(client);

      await payments.refundPayment({
        paymentId: "pay_123",
      });

      expect(
        client.client.payments.refund,
      ).toHaveBeenCalledOnce();

      expect(
        client.client.payments.refund,
      ).toHaveBeenCalledWith(
        "pay_123",
        {},
      );
    });

    it("normalizes a numeric refund amount", async () => {
      const client = createClient();

      vi.mocked(
        client.client.payments.refund,
      ).mockResolvedValue({
        id: "rfnd_789",
        payment_id: "pay_123",
        amount: 25000,
        currency: "INR",
        status: "processed",
      } as never);

      const payments =
        new RazorpayPayments(client);

      const result =
        await payments.refundPayment({
          paymentId: "pay_123",
          amount: 25000,
        });

      expect(result.amount).toBe(25000);
    });

    it("rejects a refund response with missing required fields", async () => {
      const client = createClient();

      vi.mocked(
        client.client.payments.refund,
      ).mockResolvedValue({
        id: "rfnd_123",
        payment_id: "pay_123",
        amount: undefined,
        currency: "INR",
        status: "processed",
      } as never);

      const payments =
        new RazorpayPayments(client);

      await expect(
        payments.refundPayment({
          paymentId: "pay_123",
        }),
      ).rejects.toThrow(
        "Razorpay refund response is missing required fields.",
      );
    });

    it("rejects a refund response with a non-numeric amount", async () => {
      const client = createClient();

      vi.mocked(
        client.client.payments.refund,
      ).mockResolvedValue({
        id: "rfnd_123",
        payment_id: "pay_123",
        amount: "not-a-number",
        currency: "INR",
        status: "processed",
      } as never);

      const payments =
        new RazorpayPayments(client);

      await expect(
        payments.refundPayment({
          paymentId: "pay_123",
        }),
      ).rejects.toThrow(
        "Razorpay refund response returned a non-numeric amount",
      );
    });

    it("propagates refund errors", async () => {
      const client = createClient();

      const error =
        new Error("Razorpay refund failed");

      vi.mocked(
        client.client.payments.refund,
      ).mockRejectedValue(error);

      const payments =
        new RazorpayPayments(client);

      await expect(
        payments.refundPayment({
          paymentId: "pay_123",
        }),
      ).rejects.toBe(error);
    });
  });
});