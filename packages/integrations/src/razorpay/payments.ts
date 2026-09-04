import type {
  RazorpayClient,
} from "./client.js";

import {
  verifyRazorpayPaymentSignature,
} from "./signatures.js";

import type {
  RazorpayPaymentResponse,
  RazorpayPaymentVerificationInput,
} from "./types.js";

export interface RazorpayCapturePaymentInput {
  paymentId: string;
  amount: number;
  currency: string;
}

export interface RazorpayCapturePaymentResult {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
}

export interface RazorpayRefundPaymentInput {
  paymentId: string;
  amount?: number;
  notes?: Record<string, string>;
}

export interface RazorpayRefundPaymentResult {
  id: string;
  payment_id: string;
  amount: number;
  currency: string;
  status: string;
}
function toAmountNumber(
  value: unknown,
  context: string,
): number {
  const amount =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;

  if (!Number.isFinite(amount)) {
    throw new Error(
      `Razorpay ${context} response returned a non-numeric amount: ${String(value)}`,
    );
  }

  return amount;
}

export class RazorpayPayments {
  constructor(
    private readonly razorpayClient: RazorpayClient,
  ) {}

  async fetchPayment(
    paymentId: string,
  ): Promise<RazorpayPaymentResponse> {
    const payment =
      await this.razorpayClient.client.payments.fetch(
        paymentId,
      );

    return payment as RazorpayPaymentResponse;
  }

  verifyPaymentSignature(
    input: RazorpayPaymentVerificationInput,
  ): boolean {
    return verifyRazorpayPaymentSignature(
      input.orderId,
      input.paymentId,
      input.signature,
      this.razorpayClient.keySecret,
    );
  }

  async capturePayment(
    input: RazorpayCapturePaymentInput,
  ): Promise<RazorpayCapturePaymentResult> {
    const payment =
      await this.razorpayClient.client.payments.capture(
        input.paymentId,
        input.amount,
        input.currency,
      );

    if (
      payment.id === undefined ||
      payment.order_id === undefined ||
      payment.amount === undefined ||
      payment.currency === undefined ||
      payment.status === undefined
    ) {
      throw new Error(
        "Razorpay capture response is missing required fields.",
      );
    }

    return {
      id: payment.id,
      order_id: payment.order_id,
      amount: toAmountNumber(payment.amount, "capture"),
      currency: payment.currency,
      status: payment.status,
    };
  }

  async refundPayment(
    input: RazorpayRefundPaymentInput,
  ): Promise<RazorpayRefundPaymentResult> {
    const refund =
      await this.razorpayClient.client.payments.refund(
        input.paymentId,
        {
          ...(input.amount !== undefined
            ? {
                amount: input.amount,
              }
            : {}),
          ...(input.notes !== undefined
            ? {
                notes: input.notes,
              }
            : {}),
        },
      );

    if (
      refund.id === undefined ||
      refund.payment_id === undefined ||
      refund.amount === undefined ||
      refund.currency === undefined ||
      refund.status === undefined
    ) {
      throw new Error(
        "Razorpay refund response is missing required fields.",
      );
    }

    return {
      id: refund.id,
      payment_id: refund.payment_id,
      amount: toAmountNumber(refund.amount, "refund"),
      currency: refund.currency,
      status: refund.status,
    };
  }
}