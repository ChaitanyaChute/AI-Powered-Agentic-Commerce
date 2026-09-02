import { describe, expect, it, vi } from "vitest";
import { PaymentService } from "./payment.service.js";
import type {
  CreatePaymentOrderResult,
} from "./payment-provider.js";

describe("PaymentService", () => {
  function createMocks() {
    const orderRepository = {
      findByIdWithItems: vi.fn(),
    };

    const paymentRepository = {
      getPaymentById: vi.fn(),
      getPaymentByOrderId: vi.fn(),
      createPayment: vi.fn(),
      createAttempt: vi.fn(),
      updatePaymentStatus: vi.fn(),
      updateProviderOrderId: vi.fn(),
      findByProviderPaymentId: vi.fn(),
    };

    const paymentProvider = {
      name: "RAZORPAY" as const,

      createOrder: vi.fn(),

      getPayment: vi.fn(),

      verifyPayment: vi.fn(),

      capturePayment: vi.fn(),

      refundPayment: vi.fn(),
    };

    const service = new PaymentService(
      orderRepository as any,
      paymentRepository as any,
      paymentProvider,
    );

    return {
      service,
      orderRepository,
      paymentRepository,
      paymentProvider,
    };
  }

  function createOrder(overrides = {}) {
    return {
      id: "order-1",
      orderNumber: "ORD-001",
      customerId: "customer-1",
      status: "CREATED",
      currency: "INR",
      subtotalMinor: 100000,
      totalMinor: 100000,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [],
      ...overrides,
    };
  }

  function createPayment(overrides = {}) {
    return {
      id: "payment-1",
      orderId: "order-1",
      provider: "RAZORPAY",
      providerOrderId: null,
      providerPaymentId: null,
      amountMinor: 100000,
      currency: "INR",
      status: "CREATED",
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  it("creates a payment for a valid order", async () => {
    const {
      service,
      orderRepository,
      paymentRepository,
      paymentProvider,
    } = createMocks();

    const order = createOrder();

    const payment = createPayment();

    const providerOrder: CreatePaymentOrderResult = {
      providerOrderId: "rzp_order_123",
      amountMinor: 100000,
      currency: "INR",
    };

    orderRepository.findByIdWithItems.mockResolvedValue(order);

    paymentRepository.getPaymentByOrderId.mockResolvedValue(null);

    paymentRepository.createPayment.mockResolvedValue(payment);

    paymentRepository.createAttempt.mockResolvedValue({
      id: "attempt-1",
      paymentId: payment.id,
      attemptNumber: 1,
      status: "CREATED",
      providerReference: providerOrder.providerOrderId,
      failureCode: null,
      failureMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    paymentProvider.createOrder.mockResolvedValue(providerOrder);

    paymentRepository.updateProviderOrderId.mockResolvedValue({
      ...payment,
      providerOrderId: providerOrder.providerOrderId,
    });

    const result =
      await service.createPaymentForOrder({
        orderId: order.id,
      });

    expect(result.payment).not.toBeNull();

    expect(result.payment?.providerOrderId).toBe(
      providerOrder.providerOrderId,
    );

    expect(result.providerOrder).toEqual(
      providerOrder,
    );

    expect(
      paymentRepository.createPayment,
    ).toHaveBeenCalledTimes(1);

    expect(
      paymentProvider.createOrder,
    ).toHaveBeenCalledTimes(1);

    expect(
      paymentRepository.createAttempt,
    ).toHaveBeenCalledTimes(1);

    expect(
      paymentRepository.updateProviderOrderId,
    ).toHaveBeenCalledTimes(1);
  });

  it("uses the order total as the payment amount", async () => {
    const {
      service,
      orderRepository,
      paymentRepository,
      paymentProvider,
    } = createMocks();

    const order = createOrder({
      subtotalMinor: 250000,
      totalMinor: 275000,
    });

    const payment = createPayment({
      amountMinor: 275000,
    });

    const providerOrder: CreatePaymentOrderResult = {
      providerOrderId: "rzp_order_456",
      amountMinor: 275000,
      currency: "INR",
    };

    orderRepository.findByIdWithItems.mockResolvedValue(order);

    paymentRepository.getPaymentByOrderId.mockResolvedValue(null);

    paymentRepository.createPayment.mockResolvedValue(payment);

    paymentRepository.createAttempt.mockResolvedValue({});

    paymentRepository.updateProviderOrderId.mockResolvedValue({
      ...payment,
      providerOrderId: providerOrder.providerOrderId,
    });

    paymentProvider.createOrder.mockResolvedValue(providerOrder);

    await service.createPaymentForOrder({
      orderId: order.id,
    });

    expect(
      paymentRepository.createPayment,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        amountMinor: order.totalMinor,
        currency: order.currency,
      }),
    );

    expect(
      paymentProvider.createOrder,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        amountMinor: order.totalMinor,
        currency: order.currency,
      }),
    );
  });

  it("rejects when the order does not exist", async () => {
    const {
      service,
      orderRepository,
      paymentRepository,
    } = createMocks();

    orderRepository.findByIdWithItems.mockResolvedValue(
      null,
    );

    await expect(
      service.createPaymentForOrder({
        orderId: "missing-order",
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: "ORDER_NOT_FOUND",
    });

    expect(
      paymentRepository.createPayment,
    ).not.toHaveBeenCalled();
  });

  it("rejects payment creation for an invalid order state", async () => {
    const {
      service,
      orderRepository,
      paymentRepository,
    } = createMocks();

    orderRepository.findByIdWithItems.mockResolvedValue(
      createOrder({
        status: "PAID",
      }),
    );

    await expect(
      service.createPaymentForOrder({
        orderId: "order-1",
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "INVALID_ORDER_PAYMENT_STATE",
    });

    expect(
      paymentRepository.getPaymentByOrderId,
    ).not.toHaveBeenCalled();

    expect(
      paymentRepository.createPayment,
    ).not.toHaveBeenCalled();
  });

  it("rejects when a payment already exists", async () => {
    const {
      service,
      orderRepository,
      paymentRepository,
      paymentProvider,
    } = createMocks();

    orderRepository.findByIdWithItems.mockResolvedValue(
      createOrder(),
    );

    paymentRepository.getPaymentByOrderId.mockResolvedValue(
      createPayment(),
    );

    await expect(
      service.createPaymentForOrder({
        orderId: "order-1",
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "PAYMENT_ALREADY_EXISTS",
    });

    expect(
      paymentRepository.createPayment,
    ).not.toHaveBeenCalled();

    expect(
      paymentProvider.createOrder,
    ).not.toHaveBeenCalled();
  });

  it("creates the first payment attempt", async () => {
    const {
      service,
      orderRepository,
      paymentRepository,
      paymentProvider,
    } = createMocks();

    const order = createOrder();

    const payment = createPayment();

    const providerOrder: CreatePaymentOrderResult = {
      providerOrderId: "rzp_order_attempt",
      amountMinor: order.totalMinor,
      currency: order.currency,
    };

    orderRepository.findByIdWithItems.mockResolvedValue(order);

    paymentRepository.getPaymentByOrderId.mockResolvedValue(null);

    paymentRepository.createPayment.mockResolvedValue(payment);

    paymentProvider.createOrder.mockResolvedValue(
      providerOrder,
    );

    paymentRepository.createAttempt.mockResolvedValue({});

    paymentRepository.updateProviderOrderId.mockResolvedValue({
      ...payment,
      providerOrderId: providerOrder.providerOrderId,
    });

    await service.createPaymentForOrder({
      orderId: order.id,
    });

    expect(
      paymentRepository.createAttempt,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        payment: {
          connect: {
            id: payment.id,
          },
        },
        attemptNumber: 1,
        status: "CREATED",
        providerReference:
          providerOrder.providerOrderId,
      }),
    );
  });

  it("persists the provider order ID", async () => {
    const {
      service,
      orderRepository,
      paymentRepository,
      paymentProvider,
    } = createMocks();

    const order = createOrder();

    const payment = createPayment();

    const providerOrder: CreatePaymentOrderResult = {
      providerOrderId: "rzp_order_persist",
      amountMinor: order.totalMinor,
      currency: order.currency,
    };

    orderRepository.findByIdWithItems.mockResolvedValue(order);

    paymentRepository.getPaymentByOrderId.mockResolvedValue(null);

    paymentRepository.createPayment.mockResolvedValue(payment);

    paymentProvider.createOrder.mockResolvedValue(
      providerOrder,
    );

    paymentRepository.createAttempt.mockResolvedValue({});

    paymentRepository.updateProviderOrderId.mockResolvedValue({
      ...payment,
      providerOrderId: providerOrder.providerOrderId,
    });

    await service.createPaymentForOrder({
      orderId: order.id,
    });

    expect(
      paymentRepository.updateProviderOrderId,
    ).toHaveBeenCalledWith(
      payment.id,
      providerOrder.providerOrderId,
    );
  });
});