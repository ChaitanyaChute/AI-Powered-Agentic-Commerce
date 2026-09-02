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
      throw new AppError(
        "Payment not found.",
        404,
        "PAYMENT_NOT_FOUND",
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
      throw new AppError(
        `Cannot create payment for order in ${order.status} state.`,
        409,
        "INVALID_ORDER_PAYMENT_STATE",
      );
    }

    const existingPayment =
      await this.paymentRepository.getPaymentByOrderId(
        order.id,
      );

    if (existingPayment) {
      throw new AppError(
        "A payment already exists for this order.",
        409,
        "PAYMENT_ALREADY_EXISTS",
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

    const providerOrder =
      await this.paymentProvider.createOrder({
        paymentId: payment.id,
        orderId: order.id,
        amountMinor,
        currency,
        receipt: order.orderNumber,
      });

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
      throw new AppError(
        "Payment not found.",
        404,
        "PAYMENT_NOT_FOUND",
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