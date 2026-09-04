import {
  OrderRepository,
  PaymentRepository,
} from "@repo/database";

import { AppError } from "../../middleware/error-handler.js";

import type {
  PaymentProvider,
  CreatePaymentOrderResult,
} from "./payment-provider.js";

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
}