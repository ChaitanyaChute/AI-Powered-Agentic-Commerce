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
