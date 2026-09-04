import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  CapturePaymentInput,
  CapturePaymentResult,
  CreatePaymentOrderInput,
  CreatePaymentOrderResult,
  GetPaymentInput,
  GetPaymentResult,
  PaymentProvider,
  RefundPaymentInput,
  RefundPaymentResult,
  VerifyPaymentInput,
  VerifyPaymentResult,
} from "@repo/shared"

class FakePaymentProvider
  implements PaymentProvider
{
  readonly name = "RAZORPAY" as const;

  async createOrder(
    input: CreatePaymentOrderInput,
  ): Promise<CreatePaymentOrderResult> {
    return {
      providerOrderId: `provider-order-${input.orderId}`,
      amountMinor: input.amountMinor,
      currency: input.currency,
    };
  }

  async getPayment(
    input: GetPaymentInput,
  ): Promise<GetPaymentResult> {
    return {
      providerPaymentId:
        input.providerPaymentId,
      providerOrderId: "provider-order-1",
      amountMinor: 1000,
      currency: "INR",
      status: "created",
    };
  }

  async verifyPayment(
    input: VerifyPaymentInput,
  ): Promise<VerifyPaymentResult> {
    return {
      verified:
        input.signature.length > 0,
      providerPaymentId:
        input.providerPaymentId,
      providerOrderId:
        input.providerOrderId,
    };
  }

  async capturePayment(
    input: CapturePaymentInput,
  ): Promise<CapturePaymentResult> {
    return {
      providerPaymentId:
        input.providerPaymentId,
      providerOrderId: "provider-order-1",
      amountMinor: input.amountMinor,
      currency: input.currency,
      status: "captured",
    };
  }

  async refundPayment(
    input: RefundPaymentInput,
  ): Promise<RefundPaymentResult> {
    return {
      providerPaymentId:
        input.providerPaymentId,
      refundId: "refund-1",
      amountMinor:
        input.amountMinor ?? 1000,
      currency: "INR",
      status: "processed",
    };
  }
}

describe("PaymentProvider contract", () => {
  it("supports creating a provider order", async () => {
    const provider =
      new FakePaymentProvider();

    const result =
      await provider.createOrder({
        paymentId: "payment-1",
        orderId: "order-1",
        amountMinor: 6994800,
        currency: "INR",
        receipt: "ORD-123",
      });

    expect(result).toEqual({
      providerOrderId: "provider-order-order-1",
      amountMinor: 6994800,
      currency: "INR",
    });
  });

  it("supports retrieving a provider payment", async () => {
    const provider =
      new FakePaymentProvider();

    const result =
      await provider.getPayment({
        providerPaymentId:
          "provider-payment-1",
      });

    expect(result).toEqual({
      providerPaymentId:
        "provider-payment-1",
      providerOrderId: "provider-order-1",
      amountMinor: 1000,
      currency: "INR",
      status: "created",
    });
  });

  it("supports payment verification", async () => {
    const provider =
      new FakePaymentProvider();

    const result =
      await provider.verifyPayment({
        providerOrderId:
          "provider-order-1",
        providerPaymentId:
          "provider-payment-1",
        signature: "signature",
      });

    expect(result).toEqual({
      verified: true,
      providerPaymentId:
        "provider-payment-1",
      providerOrderId:
        "provider-order-1",
    });
  });

  it("supports payment capture", async () => {
    const provider =
      new FakePaymentProvider();

    const result =
      await provider.capturePayment({
        providerPaymentId:
          "provider-payment-1",
        amountMinor: 6994800,
        currency: "INR",
      });

    expect(result).toEqual({
      providerPaymentId:
        "provider-payment-1",
      providerOrderId:
        "provider-order-1",
      amountMinor: 6994800,
      currency: "INR",
      status: "captured",
    });
  });

  it("supports payment refunds", async () => {
    const provider =
      new FakePaymentProvider();

    const result =
      await provider.refundPayment({
        providerPaymentId:
          "provider-payment-1",
        amountMinor: 6994800,
      });

    expect(result).toEqual({
      providerPaymentId:
        "provider-payment-1",
      refundId: "refund-1",
      amountMinor: 6994800,
      currency: "INR",
      status: "processed",
    });
  });

  it("exposes the provider name", () => {
    const provider =
      new FakePaymentProvider();

    expect(provider.name).toBe(
      "RAZORPAY",
    );
  });
});