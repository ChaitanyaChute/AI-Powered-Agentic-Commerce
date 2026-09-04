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
} from "@repo/shared";

import { RazorpayClient } from "./client.js";
import { RazorpayOrders } from "./orders.js";
import { RazorpayPayments } from "./payments.js";
import { RazorpayWebhooks } from "./webhooks.js";

import type { RazorpayProviderConfig } from "./types.js";

export class RazorpayProvider implements PaymentProvider {
  public readonly name = "RAZORPAY";

  private readonly client: RazorpayClient;
  private readonly orders: RazorpayOrders;
  private readonly payments: RazorpayPayments;
  private readonly webhooks: RazorpayWebhooks;
  private readonly webhookSecret: string;

  constructor(config: RazorpayProviderConfig) {
    this.webhookSecret = config.webhookSecret;

    this.client = new RazorpayClient(config);
    this.orders = new RazorpayOrders(this.client);
    this.payments = new RazorpayPayments(this.client);
    this.webhooks = new RazorpayWebhooks(
      this.webhookSecret,
    );
  }

  async createOrder(
    input: CreatePaymentOrderInput,
  ): Promise<CreatePaymentOrderResult> {
    const order = await this.orders.createOrder({
      amount: input.amountMinor,
      currency: input.currency,
      receipt: input.receipt,
      notes: input.notes,
    });

    return {
      providerOrderId: order.id,
      amountMinor: Number(order.amount),
      currency: order.currency,
    };
  }

  async getPayment(
    input: GetPaymentInput,
  ): Promise<GetPaymentResult> {
    const payment = await this.payments.fetchPayment(
      input.providerPaymentId,
    );

    return {
      providerPaymentId: payment.id,
      providerOrderId: payment.order_id,
      amountMinor: payment.amount,
      currency: payment.currency,
      status: payment.status,
    };
  }

  async verifyPayment(
    input: VerifyPaymentInput,
  ): Promise<VerifyPaymentResult> {
    const verified =
      this.payments.verifyPaymentSignature({
        orderId: input.providerOrderId,
        paymentId: input.providerPaymentId,
        signature: input.signature,
      });

    return {
      verified,
      providerPaymentId: input.providerPaymentId,
      providerOrderId: input.providerOrderId,
    };
  }

  async capturePayment(
    input: CapturePaymentInput,
  ): Promise<CapturePaymentResult> {
    const payment =
      await this.payments.capturePayment({
        paymentId: input.providerPaymentId,
        amount: input.amountMinor,
        currency: input.currency,
      });

    return {
      providerPaymentId: payment.id,
      providerOrderId: payment.order_id,
      amountMinor: payment.amount,
      currency: payment.currency,
      status: payment.status,
    };
  }

  async refundPayment(
    input: RefundPaymentInput,
  ): Promise<RefundPaymentResult> {
    const refund =
      await this.payments.refundPayment({
        paymentId: input.providerPaymentId,
        amount: input.amountMinor,
        notes: input.notes,
      });

    return {
      providerPaymentId: input.providerPaymentId,
      refundId: refund.id,
      amountMinor: refund.amount,
      currency: refund.currency,
      status: refund.status,
    };
  }

  verifyWebhookSignature(
    payload: string,
    signature: string,
  ): boolean {
    return this.webhooks.verifySignature({
      payload,
      signature,
    });
  }
}