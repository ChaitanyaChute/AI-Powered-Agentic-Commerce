import {
  OrderRepository,
  PaymentRepository,
} from "@repo/database";

import { AppError } from "../../middleware/error-handler.js";

import type {
  CapturePaymentResult,
  PaymentProvider,
  CreatePaymentOrderResult,
} from "@repo/shared";
import type {
  RazorpayWebhookPayload,
} from "../webhooks/webhook.schemas.js";

import {
  assertValidPaymentTransition,
  type PaymentStatus,
} from "./payment-state-machine.js";

import {
  PaymentError,
  PaymentErrorCode,
} from "./payment-errors.js";

export interface CreatePaymentForOrderInput {
  orderId: string;
}

export interface VerifyCheckoutPaymentInput {
  paymentId: string;
  customerId: string;
  razorpayPaymentId: string;
  razorpayOrderId: string;
  razorpaySignature: string;
}

export interface CaptureAuthorizedPaymentInput {
  paymentId: string;
  customerId?: string;
}

export interface CaptureAuthorizedPaymentResult {
  captured: boolean;
  payment: Awaited<
    ReturnType<PaymentRepository["getPaymentById"]>
  >;
  providerPayment?: CapturePaymentResult;
}

export interface PaymentStatusResult {
  id: string;
  orderId: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
}

export interface ProcessRazorpayWebhookResult {
  event: RazorpayWebhookPayload["event"];
  processed: boolean;
  paymentId?: string;
  orderId?: string;
}

export interface PaymentAuditService {
  record(event: {
    type: string;
    paymentId: string;
    orderId: string;
    customerId: string;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
}

export interface CreatePaymentForOrderResult {
  payment: Awaited<
    ReturnType<PaymentRepository["getPaymentById"]>
  >;
  providerOrder: CreatePaymentOrderResult;
}

export class PaymentService {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly paymentRepository: PaymentRepository,
    private readonly paymentProvider: PaymentProvider,
    private readonly auditService?: PaymentAuditService,
  ) {}

  async getPaymentById(id: string) {
    const payment =
      await this.paymentRepository.getPaymentById(id);

    if (!payment) {
      throw new PaymentError(
        PaymentErrorCode.NOT_FOUND,
        "Payment not found.",
        404,
      );
    }

    return payment;
  }

  async getPaymentStatusForCustomer(
    paymentId: string,
    customerId: string,
  ): Promise<PaymentStatusResult> {
    const payment =
      await this.paymentRepository.getPaymentById(
        paymentId,
      );

    if (!payment) {
      throw new PaymentError(
        PaymentErrorCode.NOT_FOUND,
        "Payment not found.",
        404,
      );
    }

    const order =
      await this.orderRepository.findByIdWithItems(
        payment.orderId,
      );

    if (!order) {
      throw new AppError(
        "Order not found.",
        404,
        "ORDER_NOT_FOUND",
      );
    }

    if (order.id !== payment.orderId) {
      throw new PaymentError(
        PaymentErrorCode.ORDER_MISMATCH,
        "Payment does not belong to this order.",
        409,
      );
    }

    if (order.customerId !== customerId) {
      throw new PaymentError(
        PaymentErrorCode.OWNERSHIP_MISMATCH,
        "Payment does not belong to this customer.",
        403,
      );
    }

    return {
      id: payment.id,
      orderId: payment.orderId,
      status: payment.status as PaymentStatus,
      amount: payment.amountMinor,
      currency: payment.currency,
    };
  }

  async createPaymentForOrder(
  input: CreatePaymentForOrderInput,
): Promise<CreatePaymentForOrderResult> {
  const order =
    await this.orderRepository.findByIdWithItems(
      input.orderId,
    );

  if (!order) {
    throw new AppError(
      "Order not found.",
      404,
      "ORDER_NOT_FOUND",
    );
  }

  if (
    order.status !== "CREATED" &&
    order.status !== "PAYMENT_PENDING"
  ) {
    throw new PaymentError(
      PaymentErrorCode.INVALID_STATE,
      `Cannot create payment for order in ${order.status} state.`,
      409,
    );
  }

  const existingPayment =
    await this.paymentRepository.getPaymentByOrderId(
      order.id,
    );

  if (existingPayment) {
    throw new PaymentError(
      PaymentErrorCode.ALREADY_EXISTS,
      "A payment already exists for this order.",
      409,
    );
  }

  const amountMinor = order.totalMinor;
  const currency = order.currency;

  const payment =
    await this.paymentRepository.createPayment({
      order: {
        connect: {
          id: order.id,
        },
      },
      provider: this.paymentProvider.name,
      amountMinor,
      currency,
      status: "CREATED",
    });

  let providerOrder: CreatePaymentOrderResult;

  try {
    providerOrder =
      await this.paymentProvider.createOrder({
        paymentId: payment.id,
        orderId: order.id,
        amountMinor,
        currency,
        receipt: order.orderNumber,
      });
  } catch (error) {
    throw new PaymentError(
      PaymentErrorCode.CREATION_FAILED,
      "Failed to create payment with provider.",
      502,
      error,
    );
  }

  if (providerOrder.amountMinor !== amountMinor) {
    throw new PaymentError(
      PaymentErrorCode.AMOUNT_MISMATCH,
      "Payment amount does not match the order total.",
      409,
      {
        expectedAmountMinor: amountMinor,
        providerAmountMinor: providerOrder.amountMinor,
      },
    );
  }

  if (providerOrder.currency !== currency) {
    throw new PaymentError(
      PaymentErrorCode.CURRENCY_MISMATCH,
      "Payment currency does not match the order currency.",
      409,
      {
        expectedCurrency: currency,
        providerCurrency: providerOrder.currency,
      },
    );
  }

  await this.paymentRepository.createAttempt({
    payment: {
      connect: {
        id: payment.id,
      },
    },
    attemptNumber: 1,
    status: "CREATED",
    providerReference:
      providerOrder.providerOrderId,
  });

  const updatedPayment =
    await this.paymentRepository.updateProviderOrderId(
      payment.id,
      providerOrder.providerOrderId,
    );

  return {
    payment: updatedPayment,
    providerOrder,
  };
}

  async transitionPaymentStatus(
    paymentId: string,
    nextStatus: PaymentStatus,
  ) {
    const payment =
      await this.paymentRepository.getPaymentById(
        paymentId,
      );

    if (!payment) {
      throw new PaymentError(
        PaymentErrorCode.NOT_FOUND,
        "Payment not found.",
        404,
      );
    }

    assertValidPaymentTransition(
      payment.status as PaymentStatus,
      nextStatus,
    );

    return this.paymentRepository.updatePaymentStatus(
      payment.id,
      nextStatus,
    );
  }

  async captureAuthorizedPayment(
    input: CaptureAuthorizedPaymentInput,
  ): Promise<CaptureAuthorizedPaymentResult> {
    const payment =
      await this.paymentRepository.getPaymentById(
        input.paymentId,
      );

    if (!payment) {
      throw new PaymentError(
        PaymentErrorCode.NOT_FOUND,
        "Payment not found.",
        404,
      );
    }

    const order =
      await this.orderRepository.findByIdWithItems(
        payment.orderId,
      );

    if (!order) {
      throw new AppError(
        "Order not found.",
        404,
        "ORDER_NOT_FOUND",
      );
    }

    if (order.id !== payment.orderId) {
      throw new PaymentError(
        PaymentErrorCode.ORDER_MISMATCH,
        "Payment does not belong to this order.",
        409,
      );
    }

    if (
      input.customerId &&
      order.customerId !== input.customerId
    ) {
      throw new PaymentError(
        PaymentErrorCode.OWNERSHIP_MISMATCH,
        "Payment does not belong to this customer.",
        403,
      );
    }

    if (payment.status === "CAPTURED") {
      return {
        captured: true,
        payment,
      };
    }

    if (!payment.providerPaymentId) {
      throw new PaymentError(
        PaymentErrorCode.INVALID_STATE,
        "Payment has not been authorized by the provider.",
        409,
      );
    }

    if (payment.amountMinor !== order.totalMinor) {
      throw new PaymentError(
        PaymentErrorCode.AMOUNT_MISMATCH,
        "Payment amount does not match the order total.",
        409,
        {
          paymentAmountMinor: payment.amountMinor,
          orderAmountMinor: order.totalMinor,
        },
      );
    }

    if (payment.currency !== order.currency) {
      throw new PaymentError(
        PaymentErrorCode.CURRENCY_MISMATCH,
        "Payment currency does not match the order currency.",
        409,
        {
          paymentCurrency: payment.currency,
          orderCurrency: order.currency,
        },
      );
    }

    assertValidPaymentTransition(
      payment.status as PaymentStatus,
      "CAPTURED",
    );

    let providerPayment: CapturePaymentResult;

    try {
      providerPayment =
        await this.paymentProvider.capturePayment({
          providerPaymentId:
            payment.providerPaymentId,
          amountMinor: payment.amountMinor,
          currency: payment.currency,
        });
    } catch (error) {
      const failedPayment =
        await this.paymentRepository.updatePaymentStatus(
          payment.id,
          "FAILED",
        );

      await this.auditService?.record({
        type: "PAYMENT_CAPTURE_FAILED",
        paymentId: payment.id,
        orderId: order.id,
        customerId: order.customerId,
        metadata: {
          providerPaymentId:
            payment.providerPaymentId,
        },
      });

      throw new PaymentError(
        PaymentErrorCode.CAPTURE_FAILED,
        "Failed to capture payment with provider.",
        502,
        {
          error,
          payment: failedPayment,
        },
      );
    }

    try {
      this.assertProviderPaymentMatches(
        payment,
        order,
        providerPayment,
      );

      if (
        providerPayment.status.toLowerCase() !==
        "captured"
      ) {
        throw new PaymentError(
          PaymentErrorCode.CAPTURE_FAILED,
          "Provider did not return a captured payment.",
          502,
          {
            providerStatus:
              providerPayment.status,
          },
        );
      }
    } catch (error) {
      await this.paymentRepository.updatePaymentStatus(
        payment.id,
        "FAILED",
      );

      throw error;
    }

    const capturedPayment =
      await this.paymentRepository.updatePaymentStatus(
        payment.id,
        "CAPTURED",
      );

    await this.orderRepository.update(
      order.id,
      {
        status: "PAID",
      },
    );

    await this.auditService?.record({
      type: "PAYMENT_CAPTURED",
      paymentId: payment.id,
      orderId: order.id,
      customerId: order.customerId,
      metadata: {
        providerOrderId:
          providerPayment.providerOrderId,
        providerPaymentId:
          providerPayment.providerPaymentId,
        amountMinor:
          providerPayment.amountMinor,
        currency: providerPayment.currency,
      },
    });

    return {
      captured: true,
      payment: capturedPayment,
      providerPayment,
    };
  }

  async processRazorpayWebhook(
    payload: RazorpayWebhookPayload,
  ): Promise<ProcessRazorpayWebhookResult> {
    switch (payload.event) {
      case "payment.authorized":
        return this.processRazorpayAuthorizedWebhook(
          payload,
        );

      case "payment.captured":
        return this.processRazorpayCapturedWebhook(
          payload,
        );

      case "payment.failed":
        return this.processRazorpayFailedWebhook(
          payload,
        );

      case "order.paid":
        return this.processRazorpayOrderPaidWebhook(
          payload,
        );
    }
  }

  async verifyCheckoutPayment(
    input: VerifyCheckoutPaymentInput,
  ) {
    const payment =
      await this.paymentRepository.getPaymentById(
        input.paymentId,
      );

    if (!payment) {
      throw new PaymentError(
        PaymentErrorCode.NOT_FOUND,
        "Payment not found.",
        404,
      );
    }

    const order =
      await this.orderRepository.findByIdWithItems(
        payment.orderId,
      );

    if (!order) {
      throw new AppError(
        "Order not found.",
        404,
        "ORDER_NOT_FOUND",
      );
    }

    if (order.id !== payment.orderId) {
      throw new PaymentError(
        PaymentErrorCode.ORDER_MISMATCH,
        "Payment does not belong to this order.",
        409,
      );
    }

    if (order.customerId !== input.customerId) {
      throw new PaymentError(
        PaymentErrorCode.OWNERSHIP_MISMATCH,
        "Payment does not belong to this customer.",
        403,
      );
    }

    if (
      payment.providerOrderId !==
      input.razorpayOrderId
    ) {
      throw new PaymentError(
        PaymentErrorCode.ORDER_MISMATCH,
        "Payment order does not match the provider order.",
        409,
      );
    }

    const existingProviderPayment =
      await this.paymentRepository.findByProviderPaymentId(
        input.razorpayPaymentId,
      );

    if (
      existingProviderPayment &&
      existingProviderPayment.id !== payment.id
    ) {
      throw new PaymentError(
        PaymentErrorCode.OWNERSHIP_MISMATCH,
        "Provider payment is already linked to a different payment.",
        409,
      );
    }

    const verification =
      await this.paymentProvider.verifyPayment({
        providerOrderId: input.razorpayOrderId,
        providerPaymentId:
          input.razorpayPaymentId,
        signature: input.razorpaySignature,
      });

    if (!verification.verified) {
      await this.auditService?.record({
        type: "PAYMENT_VERIFICATION_FAILED",
        paymentId: payment.id,
        orderId: order.id,
        customerId: order.customerId,
        metadata: {
          reason: "SIGNATURE_INVALID",
          razorpayOrderId:
            input.razorpayOrderId,
          razorpayPaymentId:
            input.razorpayPaymentId,
        },
      });

      return {
        verified: false,
        payment,
      };
    }

    const providerPayment =
      await this.paymentProvider.getPayment({
        providerPaymentId:
          input.razorpayPaymentId,
      });

    if (
      providerPayment.providerOrderId !==
      input.razorpayOrderId
    ) {
      throw new PaymentError(
        PaymentErrorCode.ORDER_MISMATCH,
        "Provider payment does not belong to the verified order.",
        409,
      );
    }

    if (
      providerPayment.amountMinor !==
        payment.amountMinor ||
      providerPayment.amountMinor !==
        order.totalMinor
    ) {
      throw new PaymentError(
        PaymentErrorCode.AMOUNT_MISMATCH,
        "Provider payment amount does not match the internal payment amount.",
        409,
        {
          expectedAmountMinor:
            payment.amountMinor,
          orderAmountMinor: order.totalMinor,
          providerAmountMinor:
            providerPayment.amountMinor,
        },
      );
    }

    if (
      providerPayment.currency !==
        payment.currency ||
      providerPayment.currency !== order.currency
    ) {
      throw new PaymentError(
        PaymentErrorCode.CURRENCY_MISMATCH,
        "Provider payment currency does not match the internal payment currency.",
        409,
        {
          expectedCurrency: payment.currency,
          orderCurrency: order.currency,
          providerCurrency:
            providerPayment.currency,
        },
      );
    }

    if (
      payment.status === "CAPTURED" &&
      payment.providerPaymentId ===
        input.razorpayPaymentId &&
      providerPayment.status.toLowerCase() ===
        "captured"
    ) {
      return {
        verified: true,
        payment,
        capture: {
          captured: true,
          payment,
          providerPayment,
        },
      };
    }

    if (
      providerPayment.status.toLowerCase() !==
      "authorized"
    ) {
      throw new PaymentError(
        PaymentErrorCode.INVALID_STATE,
        "Provider payment is not authorized for capture.",
        409,
        {
          providerStatus:
            providerPayment.status,
        },
      );
    }

    assertValidPaymentTransition(
      payment.status as PaymentStatus,
      "AUTHORIZED",
    );

    const authorizedPayment =
      await this.paymentRepository.markVerified({
        id: payment.id,
        providerPaymentId:
          input.razorpayPaymentId,
        status: "AUTHORIZED",
      });

    await this.auditService?.record({
      type: "PAYMENT_AUTHORIZED",
      paymentId: payment.id,
      orderId: order.id,
      customerId: order.customerId,
      metadata: {
        razorpayOrderId:
          input.razorpayOrderId,
        razorpayPaymentId:
          input.razorpayPaymentId,
        amountMinor:
          providerPayment.amountMinor,
        currency: providerPayment.currency,
      },
    });

    const captureResult =
      await this.captureAuthorizedPayment({
        paymentId: authorizedPayment.id,
        customerId: order.customerId,
      });

    return {
      verified: true,
      payment: captureResult.payment,
      capture: captureResult,
    };
  }

  private async processRazorpayAuthorizedWebhook(
    payload: RazorpayWebhookPayload,
  ): Promise<ProcessRazorpayWebhookResult> {
    const entity =
      this.getPaymentWebhookEntity(payload);
    const payment =
      await this.findPaymentForRazorpayPayment(
        entity.id,
        entity.order_id,
      );
    const order =
      await this.getOrderForPayment(payment);

    this.assertWebhookPaymentMatches(
      payment,
      order,
      entity,
    );

    if (
      payment.status === "CAPTURED" ||
      payment.status === "REFUNDED" ||
      payment.status === "REFUND_PENDING"
    ) {
      return {
        event: payload.event,
        processed: true,
        paymentId: payment.id,
        orderId: order.id,
      };
    }

    const authorizedPayment =
      await this.paymentRepository.updateProviderPaymentStatus(
        {
          id: payment.id,
          providerPaymentId: entity.id,
          status: "AUTHORIZED",
        },
      );

    await this.auditService?.record({
      type: "PAYMENT_AUTHORIZED_WEBHOOK",
      paymentId: authorizedPayment.id,
      orderId: order.id,
      customerId: order.customerId,
      metadata: {
        providerOrderId: entity.order_id,
        providerPaymentId: entity.id,
      },
    });

    await this.captureAuthorizedPayment({
      paymentId: authorizedPayment.id,
    });

    return {
      event: payload.event,
      processed: true,
      paymentId: authorizedPayment.id,
      orderId: order.id,
    };
  }

  private async processRazorpayCapturedWebhook(
    payload: RazorpayWebhookPayload,
  ): Promise<ProcessRazorpayWebhookResult> {
    const entity =
      this.getPaymentWebhookEntity(payload);
    const payment =
      await this.findPaymentForRazorpayPayment(
        entity.id,
        entity.order_id,
      );
    const order =
      await this.getOrderForPayment(payment);

    this.assertWebhookPaymentMatches(
      payment,
      order,
      entity,
    );

    const capturedPayment =
      payment.status === "CAPTURED" &&
      payment.providerPaymentId === entity.id
        ? payment
        : await this.paymentRepository.updateProviderPaymentStatus(
            {
              id: payment.id,
              providerPaymentId: entity.id,
              status: "CAPTURED",
            },
          );

    if (order.status !== "PAID") {
      await this.orderRepository.update(
        order.id,
        {
          status: "PAID",
        },
      );
    }

    await this.auditService?.record({
      type: "PAYMENT_CAPTURED_WEBHOOK",
      paymentId: capturedPayment.id,
      orderId: order.id,
      customerId: order.customerId,
      metadata: {
        providerOrderId: entity.order_id,
        providerPaymentId: entity.id,
      },
    });

    return {
      event: payload.event,
      processed: true,
      paymentId: capturedPayment.id,
      orderId: order.id,
    };
  }

  private async processRazorpayFailedWebhook(
    payload: RazorpayWebhookPayload,
  ): Promise<ProcessRazorpayWebhookResult> {
    const entity =
      this.getPaymentWebhookEntity(payload);
    const payment =
      await this.findPaymentForRazorpayPayment(
        entity.id,
        entity.order_id,
      );
    const order =
      await this.getOrderForPayment(payment);

    this.assertWebhookPaymentMatches(
      payment,
      order,
      entity,
    );

    if (
      payment.status === "CAPTURED" ||
      payment.status === "REFUNDED" ||
      payment.status === "REFUND_PENDING"
    ) {
      return {
        event: payload.event,
        processed: true,
        paymentId: payment.id,
        orderId: order.id,
      };
    }

    const failedPayment =
      await this.paymentRepository.updateProviderPaymentStatus(
        {
          id: payment.id,
          providerPaymentId: entity.id,
          status: "FAILED",
        },
      );

    await this.orderRepository.update(
      order.id,
      {
        status: "PAYMENT_FAILED",
      },
    );

    await this.auditService?.record({
      type: "PAYMENT_FAILED_WEBHOOK",
      paymentId: failedPayment.id,
      orderId: order.id,
      customerId: order.customerId,
      metadata: {
        providerOrderId: entity.order_id,
        providerPaymentId: entity.id,
        failureCode: entity.error_code,
        failureMessage:
          entity.error_description,
      },
    });

    return {
      event: payload.event,
      processed: true,
      paymentId: failedPayment.id,
      orderId: order.id,
    };
  }

  private async processRazorpayOrderPaidWebhook(
    payload: RazorpayWebhookPayload,
  ): Promise<ProcessRazorpayWebhookResult> {
    const entity =
      payload.payload.order?.entity;

    if (!entity) {
      throw new AppError(
        "Razorpay order webhook payload is missing order data.",
        400,
        "RAZORPAY_WEBHOOK_ORDER_MISSING",
      );
    }

    const payment =
      await this.paymentRepository.findByProviderOrderId(
        entity.id,
      );

    if (!payment) {
      throw new PaymentError(
        PaymentErrorCode.NOT_FOUND,
        "Payment not found for Razorpay order.",
        404,
      );
    }

    const order =
      await this.getOrderForPayment(payment);

    if (
      typeof entity.amount_paid === "number" &&
      entity.amount_paid !== payment.amountMinor
    ) {
      throw new PaymentError(
        PaymentErrorCode.AMOUNT_MISMATCH,
        "Razorpay order paid amount does not match the internal payment amount.",
        409,
        {
          expectedAmountMinor:
            payment.amountMinor,
          providerAmountMinor:
            entity.amount_paid,
        },
      );
    }

    if (
      entity.currency &&
      entity.currency !== payment.currency
    ) {
      throw new PaymentError(
        PaymentErrorCode.CURRENCY_MISMATCH,
        "Razorpay order currency does not match the internal payment currency.",
        409,
        {
          expectedCurrency:
            payment.currency,
          providerCurrency:
            entity.currency,
        },
      );
    }

    if (payment.status !== "CAPTURED") {
      await this.paymentRepository.updatePaymentStatus(
        payment.id,
        "CAPTURED",
      );
    }

    if (order.status !== "PAID") {
      await this.orderRepository.update(
        order.id,
        {
          status: "PAID",
        },
      );
    }

    await this.auditService?.record({
      type: "ORDER_PAID_WEBHOOK",
      paymentId: payment.id,
      orderId: order.id,
      customerId: order.customerId,
      metadata: {
        providerOrderId: entity.id,
      },
    });

    return {
      event: payload.event,
      processed: true,
      paymentId: payment.id,
      orderId: order.id,
    };
  }

  private getPaymentWebhookEntity(
    payload: RazorpayWebhookPayload,
  ) {
    const entity =
      payload.payload.payment?.entity;

    if (!entity) {
      throw new AppError(
        "Razorpay payment webhook payload is missing payment data.",
        400,
        "RAZORPAY_WEBHOOK_PAYMENT_MISSING",
      );
    }

    return entity;
  }

  private async findPaymentForRazorpayPayment(
    providerPaymentId: string,
    providerOrderId: string,
  ) {
    const paymentByProviderPaymentId =
      await this.paymentRepository.findByProviderPaymentId(
        providerPaymentId,
      );

    if (paymentByProviderPaymentId) {
      return paymentByProviderPaymentId;
    }

    const paymentByProviderOrderId =
      await this.paymentRepository.findByProviderOrderId(
        providerOrderId,
      );

    if (!paymentByProviderOrderId) {
      throw new PaymentError(
        PaymentErrorCode.NOT_FOUND,
        "Payment not found for Razorpay webhook.",
        404,
      );
    }

    return paymentByProviderOrderId;
  }

  private async getOrderForPayment(
    payment: Awaited<
      ReturnType<
        PaymentRepository["getPaymentById"]
      >
    >,
  ) {
    if (!payment) {
      throw new PaymentError(
        PaymentErrorCode.NOT_FOUND,
        "Payment not found.",
        404,
      );
    }

    const order =
      await this.orderRepository.findByIdWithItems(
        payment.orderId,
      );

    if (!order) {
      throw new AppError(
        "Order not found.",
        404,
        "ORDER_NOT_FOUND",
      );
    }

    return order;
  }

  private assertWebhookPaymentMatches(
    payment: NonNullable<
      Awaited<
        ReturnType<
          PaymentRepository["getPaymentById"]
        >
      >
    >,
    order: NonNullable<
      Awaited<
        ReturnType<
          OrderRepository["findByIdWithItems"]
        >
      >
    >,
    entity: {
      id: string;
      order_id: string;
      amount: number;
      currency: string;
    },
  ): void {
    if (
      payment.providerOrderId !==
      entity.order_id
    ) {
      throw new PaymentError(
        PaymentErrorCode.ORDER_MISMATCH,
        "Razorpay payment does not belong to the internal payment order.",
        409,
      );
    }

    if (order.id !== payment.orderId) {
      throw new PaymentError(
        PaymentErrorCode.ORDER_MISMATCH,
        "Payment does not belong to this order.",
        409,
      );
    }

    if (
      payment.providerPaymentId &&
      payment.providerPaymentId !== entity.id
    ) {
      throw new PaymentError(
        PaymentErrorCode.OWNERSHIP_MISMATCH,
        "Razorpay payment is already linked to a different provider payment.",
        409,
      );
    }

    if (
      entity.amount !== payment.amountMinor ||
      entity.amount !== order.totalMinor
    ) {
      throw new PaymentError(
        PaymentErrorCode.AMOUNT_MISMATCH,
        "Razorpay payment amount does not match the internal payment amount.",
        409,
        {
          expectedAmountMinor:
            payment.amountMinor,
          orderAmountMinor: order.totalMinor,
          providerAmountMinor:
            entity.amount,
        },
      );
    }

    if (
      entity.currency !== payment.currency ||
      entity.currency !== order.currency
    ) {
      throw new PaymentError(
        PaymentErrorCode.CURRENCY_MISMATCH,
        "Razorpay payment currency does not match the internal payment currency.",
        409,
        {
          expectedCurrency:
            payment.currency,
          orderCurrency: order.currency,
          providerCurrency:
            entity.currency,
        },
      );
    }
  }

  private assertProviderPaymentMatches(
    payment: Awaited<
      ReturnType<PaymentRepository["getPaymentById"]>
    >,
    order: Awaited<
      ReturnType<OrderRepository["findByIdWithItems"]>
    >,
    providerPayment: CapturePaymentResult,
  ): void {
    if (!payment || !order) {
      throw new PaymentError(
        PaymentErrorCode.NOT_FOUND,
        "Payment or order not found.",
        404,
      );
    }

    if (
      providerPayment.providerOrderId !==
      payment.providerOrderId
    ) {
      throw new PaymentError(
        PaymentErrorCode.ORDER_MISMATCH,
        "Provider payment does not belong to the internal order.",
        409,
      );
    }

    if (
      providerPayment.amountMinor !==
        payment.amountMinor ||
      providerPayment.amountMinor !==
        order.totalMinor
    ) {
      throw new PaymentError(
        PaymentErrorCode.AMOUNT_MISMATCH,
        "Provider payment amount does not match the internal payment amount.",
        409,
        {
          expectedAmountMinor:
            payment.amountMinor,
          orderAmountMinor: order.totalMinor,
          providerAmountMinor:
            providerPayment.amountMinor,
        },
      );
    }

    if (
      providerPayment.currency !==
        payment.currency ||
      providerPayment.currency !== order.currency
    ) {
      throw new PaymentError(
        PaymentErrorCode.CURRENCY_MISMATCH,
        "Provider payment currency does not match the internal payment currency.",
        409,
        {
          expectedCurrency: payment.currency,
          orderCurrency: order.currency,
          providerCurrency:
            providerPayment.currency,
        },
      );
    }

    if (
      providerPayment.providerPaymentId !==
      payment.providerPaymentId
    ) {
      throw new PaymentError(
        PaymentErrorCode.OWNERSHIP_MISMATCH,
        "Provider payment ID does not match the internal payment.",
        409,
      );
    }
  }
}
