import { beforeEach, describe, expect, it, vi } from "vitest";
import { PaymentService } from "./payment.service.js";
import {
  PaymentError,
  PaymentErrorCode,
} from "./payment-errors.js";
import type {
  CreatePaymentOrderResult,
  PaymentProvider,
} from "@repo/shared";
import type {
  OrderRepository,
  PaymentRepository,
} from "@repo/database";

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
      code: "PAYMENT_INVALID_STATE",
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

  it("rejects a provider order with a different amount", async () => {
    const {
      service,
      orderRepository,
      paymentRepository,
      paymentProvider,
    } = createMocks();

    const order = createOrder({
      totalMinor: 6_949_800,
      currency: "INR",
    });

    const payment = createPayment({
      amountMinor: order.totalMinor,
      currency: order.currency,
    });

    orderRepository.findByIdWithItems.mockResolvedValue(order);

    paymentRepository.getPaymentByOrderId.mockResolvedValue(null);

    paymentRepository.createPayment.mockResolvedValue(payment);

    paymentProvider.createOrder.mockResolvedValue({
      providerOrderId: "provider-order-1",
      amountMinor: 6_949_700,
      currency: "INR",
    });

    await expect(
      service.createPaymentForOrder({
        orderId: order.id,
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "PAYMENT_AMOUNT_MISMATCH",
    });
  });

  it("sends the exact order total to the provider", async () => {
  const {
    service,
    orderRepository,
    paymentRepository,
    paymentProvider,
  } = createMocks();

  const order = createOrder({
    subtotalMinor: 6_900_000,
    totalMinor: 6_949_800,
    currency: "INR",
  });

  const payment = createPayment({
    amountMinor: order.totalMinor,
    currency: order.currency,
  });

  const providerOrder: CreatePaymentOrderResult = {
    providerOrderId: "rzp_order_exact_amount",
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
    paymentProvider.createOrder,
  ).toHaveBeenCalledWith({
    paymentId: payment.id,
    orderId: order.id,
    amountMinor: 6_949_800,
    currency: "INR",
    receipt: order.orderNumber,
  });
});

it("does not persist the provider order ID when the amount mismatches", async () => {
  const {
    service,
    orderRepository,
    paymentRepository,
    paymentProvider,
  } = createMocks();

  const order = createOrder({
    totalMinor: 6_949_800,
    currency: "INR",
  });

  const payment = createPayment({
    amountMinor: order.totalMinor,
    currency: order.currency,
  });

  orderRepository.findByIdWithItems.mockResolvedValue(order);

  paymentRepository.getPaymentByOrderId.mockResolvedValue(null);

  paymentRepository.createPayment.mockResolvedValue(payment);

  paymentProvider.createOrder.mockResolvedValue({
    providerOrderId: "provider-order-amount-mismatch",
    amountMinor: 6_949_700,
    currency: "INR",
  });

  await expect(
    service.createPaymentForOrder({
      orderId: order.id,
    }),
  ).rejects.toMatchObject({
    statusCode: 409,
    code: "PAYMENT_AMOUNT_MISMATCH",
  });

  expect(
    paymentRepository.updateProviderOrderId,
  ).not.toHaveBeenCalled();

  expect(
    paymentRepository.createAttempt,
  ).not.toHaveBeenCalled();
});

it("does not persist the provider order ID when the currency mismatches", async () => {
  const {
    service,
    orderRepository,
    paymentRepository,
    paymentProvider,
  } = createMocks();

  const order = createOrder({
    totalMinor: 6_949_800,
    currency: "INR",
  });

  const payment = createPayment({
    amountMinor: order.totalMinor,
    currency: order.currency,
  });

  orderRepository.findByIdWithItems.mockResolvedValue(order);

  paymentRepository.getPaymentByOrderId.mockResolvedValue(null);

  paymentRepository.createPayment.mockResolvedValue(payment);

  paymentProvider.createOrder.mockResolvedValue({
    providerOrderId: "provider-order-currency-mismatch",
    amountMinor: 6_949_800,
    currency: "USD",
  });

  await expect(
    service.createPaymentForOrder({
      orderId: order.id,
    }),
  ).rejects.toMatchObject({
    statusCode: 409,
    code: "PAYMENT_CURRENCY_MISMATCH",
  });

  expect(
    paymentRepository.updateProviderOrderId,
  ).not.toHaveBeenCalled();

  expect(
    paymentRepository.createAttempt,
  ).not.toHaveBeenCalled();
});

  it("rejects a provider order with a different currency", async () => {
    const {
      service,
      orderRepository,
      paymentRepository,
      paymentProvider,
    } = createMocks();

    const order = createOrder({
      totalMinor: 6_949_800,
      currency: "INR",
    });

    const payment = createPayment({
      amountMinor: order.totalMinor,
      currency: order.currency,
    });

    orderRepository.findByIdWithItems.mockResolvedValue(order);

    paymentRepository.getPaymentByOrderId.mockResolvedValue(null);

    paymentRepository.createPayment.mockResolvedValue(payment);

    paymentProvider.createOrder.mockResolvedValue({
      providerOrderId: "provider-order-1",
      amountMinor: 6_949_800,
      currency: "USD",
    });

    await expect(
      service.createPaymentForOrder({
        orderId: order.id,
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "PAYMENT_CURRENCY_MISMATCH",
    });
  });

});

describe("Step 50 — Amount & Currency Verification", () => {
  let orderRepository: {
    findByIdWithItems: ReturnType<typeof vi.fn>;
  };
  let paymentRepository: {
    getPaymentById: ReturnType<typeof vi.fn>;
    getPaymentByOrderId: ReturnType<typeof vi.fn>;
    createPayment: ReturnType<typeof vi.fn>;
    createAttempt: ReturnType<typeof vi.fn>;
    updatePaymentStatus: ReturnType<typeof vi.fn>;
    updateProviderOrderId: ReturnType<typeof vi.fn>;
    findByProviderPaymentId: ReturnType<typeof vi.fn>;
  };
  let paymentProvider: {
    name: "RAZORPAY";
    createOrder: ReturnType<typeof vi.fn>;
    getPayment: ReturnType<typeof vi.fn>;
    verifyPayment: ReturnType<typeof vi.fn>;
    capturePayment: ReturnType<typeof vi.fn>;
    refundPayment: ReturnType<typeof vi.fn>;
  };
  let paymentService: PaymentService;

  beforeEach(() => {
    orderRepository = {
      findByIdWithItems: vi.fn(),
    };

    paymentRepository = {
      getPaymentById: vi.fn(),
      getPaymentByOrderId: vi.fn(),
      createPayment: vi.fn(),
      createAttempt: vi.fn(),
      updatePaymentStatus: vi.fn(),
      updateProviderOrderId: vi.fn(),
      findByProviderPaymentId: vi.fn(),
    };

    paymentProvider = {
      name: "RAZORPAY",
      createOrder: vi.fn(),
      getPayment: vi.fn(),
      verifyPayment: vi.fn(),
      capturePayment: vi.fn(),
      refundPayment: vi.fn(),
    };

    paymentService = new PaymentService(
      orderRepository as any,
      paymentRepository as any,
      paymentProvider as any,
    );
  });

  it("uses the order total as the authoritative payment amount", async () => {
    const order = {
      id: "order-1",
      orderNumber: "ORD-001",
      status: "CREATED",
      totalMinor: 6949800,
      currency: "INR",
      items: [],
    };

    const createdPayment = {
      id: "payment-1",
      orderId: order.id,
      amountMinor: order.totalMinor,
      currency: order.currency,
      status: "CREATED",
    };

    const providerOrder = {
      providerOrderId: "razorpay-order-1",
      amountMinor: 6949800,
      currency: "INR",
    };

    orderRepository.findByIdWithItems.mockResolvedValue(order as any);

    paymentRepository.getPaymentByOrderId.mockResolvedValue(null);

    paymentRepository.createPayment.mockResolvedValue(
      createdPayment as any,
    );

    paymentProvider.createOrder.mockResolvedValue(
      providerOrder,
    );

    paymentRepository.createAttempt.mockResolvedValue(
      {} as any,
    );

    paymentRepository.updateProviderOrderId.mockResolvedValue(
      {
        ...createdPayment,
        providerOrderId: providerOrder.providerOrderId,
      } as any,
    );

    const result =
      await paymentService.createPaymentForOrder({
        orderId: order.id,
      });

    expect(
      paymentProvider.createOrder,
    ).toHaveBeenCalledWith({
      paymentId: createdPayment.id,
      orderId: order.id,
      amountMinor: 6949800,
      currency: "INR",
      receipt: order.orderNumber,
    });

    expect(result.providerOrder.amountMinor).toBe(
      order.totalMinor,
    );
  });

  it("rejects a provider order with a different amount", async () => {
    const order = {
      id: "order-2",
      orderNumber: "ORD-002",
      status: "CREATED",
      totalMinor: 6949800,
      currency: "INR",
      items: [],
    };

    const createdPayment = {
      id: "payment-2",
      orderId: order.id,
      amountMinor: order.totalMinor,
      currency: order.currency,
      status: "CREATED",
    };

    orderRepository.findByIdWithItems.mockResolvedValue(
      order as any,
    );

    paymentRepository.getPaymentByOrderId.mockResolvedValue(
      null,
    );

    paymentRepository.createPayment.mockResolvedValue(
      createdPayment as any,
    );

    paymentProvider.createOrder.mockResolvedValue({
      providerOrderId: "razorpay-order-2",
      amountMinor: 6949700,
      currency: "INR",
    });

    await expect(
      paymentService.createPaymentForOrder({
        orderId: order.id,
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "PAYMENT_AMOUNT_MISMATCH",
    });
  });

  it("rejects a provider order with a different currency", async () => {
    const order = {
      id: "order-3",
      orderNumber: "ORD-003",
      status: "CREATED",
      totalMinor: 6949800,
      currency: "INR",
      items: [],
    };

    const createdPayment = {
      id: "payment-3",
      orderId: order.id,
      amountMinor: order.totalMinor,
      currency: order.currency,
      status: "CREATED",
    };

    orderRepository.findByIdWithItems.mockResolvedValue(
      order as any,
    );

    paymentRepository.getPaymentByOrderId.mockResolvedValue(
      null,
    );

    paymentRepository.createPayment.mockResolvedValue(
      createdPayment as any,
    );

    paymentProvider.createOrder.mockResolvedValue({
      providerOrderId: "razorpay-order-3",
      amountMinor: 6949800,
      currency: "USD",
    });

    await expect(
      paymentService.createPaymentForOrder({
        orderId: order.id,
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "PAYMENT_CURRENCY_MISMATCH",
    });
  });

  it("does not persist the provider order ID when the amount mismatches", async () => {
    const order = {
      id: "order-4",
      orderNumber: "ORD-004",
      status: "CREATED",
      totalMinor: 6949800,
      currency: "INR",
      items: [],
    };

    const createdPayment = {
      id: "payment-4",
      orderId: order.id,
      amountMinor: order.totalMinor,
      currency: order.currency,
      status: "CREATED",
    };

    orderRepository.findByIdWithItems.mockResolvedValue(
      order as any,
    );

    paymentRepository.getPaymentByOrderId.mockResolvedValue(
      null,
    );

    paymentRepository.createPayment.mockResolvedValue(
      createdPayment as any,
    );

    paymentProvider.createOrder.mockResolvedValue({
      providerOrderId: "razorpay-order-4",
      amountMinor: 1,
      currency: "INR",
    });

    await expect(
      paymentService.createPaymentForOrder({
        orderId: order.id,
      }),
    ).rejects.toMatchObject({
      code: "PAYMENT_AMOUNT_MISMATCH",
    });

    expect(
      paymentRepository.updateProviderOrderId,
    ).not.toHaveBeenCalled();
  });

  it("does not persist the provider order ID when the currency mismatches", async () => {
    const order = {
      id: "order-5",
      orderNumber: "ORD-005",
      status: "CREATED",
      totalMinor: 6949800,
      currency: "INR",
      items: [],
    };

    const createdPayment = {
      id: "payment-5",
      orderId: order.id,
      amountMinor: order.totalMinor,
      currency: order.currency,
      status: "CREATED",
    };

    orderRepository.findByIdWithItems.mockResolvedValue(
      order as any,
    );

    paymentRepository.getPaymentByOrderId.mockResolvedValue(
      null,
    );

    paymentRepository.createPayment.mockResolvedValue(
      createdPayment as any,
    );

    paymentProvider.createOrder.mockResolvedValue({
      providerOrderId: "razorpay-order-5",
      amountMinor: 6949800,
      currency: "USD",
    });

    await expect(
      paymentService.createPaymentForOrder({
        orderId: order.id,
      }),
    ).rejects.toMatchObject({
      code: "PAYMENT_CURRENCY_MISMATCH",
    });

    expect(
      paymentRepository.updateProviderOrderId,
    ).not.toHaveBeenCalled();
  });

  it("does not create a payment attempt when the provider amount mismatches", async () => {
    const order = {
      id: "order-6",
      orderNumber: "ORD-006",
      status: "CREATED",
      totalMinor: 6949800,
      currency: "INR",
      items: [],
    };

    paymentRepository.getPaymentByOrderId.mockResolvedValue(
      null,
    );

    paymentRepository.createPayment.mockResolvedValue({
      id: "payment-6",
      orderId: order.id,
      amountMinor: order.totalMinor,
      currency: order.currency,
      status: "CREATED",
    } as any);

    orderRepository.findByIdWithItems.mockResolvedValue(
      order as any,
    );

    paymentProvider.createOrder.mockResolvedValue({
      providerOrderId: "razorpay-order-6",
      amountMinor: 6949700,
      currency: "INR",
    });

    await expect(
      paymentService.createPaymentForOrder({
        orderId: order.id,
      }),
    ).rejects.toMatchObject({
      code: "PAYMENT_AMOUNT_MISMATCH",
    });

    expect(
      paymentRepository.createAttempt,
    ).not.toHaveBeenCalled();

    expect(
      paymentRepository.updateProviderOrderId,
    ).not.toHaveBeenCalled();
  });

  it("does not create a payment attempt when the provider currency mismatches", async () => {
    const order = {
      id: "order-7",
      orderNumber: "ORD-007",
      status: "CREATED",
      totalMinor: 6949800,
      currency: "INR",
      items: [],
    };

    paymentRepository.getPaymentByOrderId.mockResolvedValue(
      null,
    );

    paymentRepository.createPayment.mockResolvedValue({
      id: "payment-7",
      orderId: order.id,
      amountMinor: order.totalMinor,
      currency: order.currency,
      status: "CREATED",
    } as any);

    orderRepository.findByIdWithItems.mockResolvedValue(
      order as any,
    );

    paymentProvider.createOrder.mockResolvedValue({
      providerOrderId: "razorpay-order-7",
      amountMinor: 6949800,
      currency: "USD",
    });

    await expect(
      paymentService.createPaymentForOrder({
        orderId: order.id,
      }),
    ).rejects.toMatchObject({
      code: "PAYMENT_CURRENCY_MISMATCH",
    });
    expect(
      paymentRepository.createAttempt,
    ).not.toHaveBeenCalled();

    expect(
      paymentRepository.updateProviderOrderId,
    ).not.toHaveBeenCalled();
  });
});
describe("PaymentService - createPaymentForOrder", () => {
  function createRepositories() {
    const orderRepository = {
      findByIdWithItems: vi.fn(),
    } as unknown as OrderRepository;

    const paymentRepository = {
      getPaymentByOrderId: vi.fn(),
      createPayment: vi.fn(),
      createAttempt: vi.fn(),
      updateProviderOrderId: vi.fn(),
    } as unknown as PaymentRepository;

    return {
      orderRepository,
      paymentRepository,
    };
  }

  function createProvider() {
    return {
      name: "RAZORPAY" as const,
      createOrder: vi.fn(),
      getPayment: vi.fn(),
      verifyPayment: vi.fn(),
      capturePayment: vi.fn(),
      refundPayment: vi.fn(),
    } satisfies PaymentProvider;
  }

  const order = {
    id: "order_123",
    orderNumber: "ORD-1001",
    totalMinor: 50000,
    currency: "INR",
    status: "CREATED",
  };

  const payment = {
    id: "payment_123",
    orderId: "order_123",
    provider: "RAZORPAY",
    providerOrderId: null,
    providerPaymentId: null,
    amountMinor: 50000,
    currency: "INR",
    status: "CREATED",
  };

  it("creates a payment and Razorpay order", async () => {
    const {
      orderRepository,
      paymentRepository,
    } = createRepositories();

    const provider = createProvider();

    vi.mocked(
      orderRepository.findByIdWithItems,
    ).mockResolvedValue(order as never);

    vi.mocked(
      paymentRepository.getPaymentByOrderId,
    ).mockResolvedValue(null);

    vi.mocked(
      paymentRepository.createPayment,
    ).mockResolvedValue(payment as never);

    vi.mocked(
      provider.createOrder,
    ).mockResolvedValue({
      providerOrderId: "order_RAZORPAY_123",
      amountMinor: 50000,
      currency: "INR",
    });

    vi.mocked(
      paymentRepository.createAttempt,
    ).mockResolvedValue({
      id: "attempt_123",
    } as never);

    vi.mocked(
      paymentRepository.updateProviderOrderId,
    ).mockResolvedValue({
      ...payment,
      providerOrderId: "order_RAZORPAY_123",
    } as never);

    const service = new PaymentService(
      orderRepository,
      paymentRepository,
      provider,
    );

    const result =
      await service.createPaymentForOrder({
        orderId: "order_123",
      });

    expect(
      provider.createOrder,
    ).toHaveBeenCalledOnce();

    expect(
      provider.createOrder,
    ).toHaveBeenCalledWith({
      paymentId: "payment_123",
      orderId: "order_123",
      amountMinor: 50000,
      currency: "INR",
      receipt: "ORD-1001",
    });

    expect(
      paymentRepository.createAttempt,
    ).toHaveBeenCalledWith({
      payment: {
        connect: {
          id: "payment_123",
        },
      },
      attemptNumber: 1,
      status: "CREATED",
      providerReference:
        "order_RAZORPAY_123",
    });

    expect(
      paymentRepository.updateProviderOrderId,
    ).toHaveBeenCalledWith(
      "payment_123",
      "order_RAZORPAY_123",
    );

    expect(result.providerOrder).toEqual({
      providerOrderId: "order_RAZORPAY_123",
      amountMinor: 50000,
      currency: "INR",
    });

    expect(
      result.payment?.providerOrderId,
    ).toBe("order_RAZORPAY_123");
  });

  it("passes the internal order amount to the provider", async () => {
    const {
      orderRepository,
      paymentRepository,
    } = createRepositories();

    const provider = createProvider();

    vi.mocked(
      orderRepository.findByIdWithItems,
    ).mockResolvedValue(order as never);

    vi.mocked(
      paymentRepository.getPaymentByOrderId,
    ).mockResolvedValue(null);

    vi.mocked(
      paymentRepository.createPayment,
    ).mockResolvedValue(payment as never);

    vi.mocked(
      provider.createOrder,
    ).mockResolvedValue({
      providerOrderId: "rzp_order_123",
      amountMinor: 50000,
      currency: "INR",
    });

    vi.mocked(
      paymentRepository.createAttempt,
    ).mockResolvedValue({} as never);

    vi.mocked(
      paymentRepository.updateProviderOrderId,
    ).mockResolvedValue({
      ...payment,
      providerOrderId: "rzp_order_123",
    } as never);

    const service = new PaymentService(
      orderRepository,
      paymentRepository,
      provider,
    );

    await service.createPaymentForOrder({
      orderId: "order_123",
    });

    expect(
      provider.createOrder,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        amountMinor: 50000,
        currency: "INR",
      }),
    );
  });

  it("uses the internal order number as the provider receipt", async () => {
    const {
      orderRepository,
      paymentRepository,
    } = createRepositories();

    const provider = createProvider();

    vi.mocked(
      orderRepository.findByIdWithItems,
    ).mockResolvedValue(order as never);

    vi.mocked(
      paymentRepository.getPaymentByOrderId,
    ).mockResolvedValue(null);

    vi.mocked(
      paymentRepository.createPayment,
    ).mockResolvedValue(payment as never);

    vi.mocked(
      provider.createOrder,
    ).mockResolvedValue({
      providerOrderId: "rzp_order_123",
      amountMinor: 50000,
      currency: "INR",
    });

    vi.mocked(
      paymentRepository.createAttempt,
    ).mockResolvedValue({} as never);

    vi.mocked(
      paymentRepository.updateProviderOrderId,
    ).mockResolvedValue({
      ...payment,
      providerOrderId: "rzp_order_123",
    } as never);

    const service = new PaymentService(
      orderRepository,
      paymentRepository,
      provider,
    );

    await service.createPaymentForOrder({
      orderId: "order_123",
    });

    expect(
      provider.createOrder,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        receipt: "ORD-1001",
      }),
    );
  });

  it("rejects when the provider amount does not match", async () => {
    const {
      orderRepository,
      paymentRepository,
    } = createRepositories();

    const provider = createProvider();

    vi.mocked(
      orderRepository.findByIdWithItems,
    ).mockResolvedValue(order as never);

    vi.mocked(
      paymentRepository.getPaymentByOrderId,
    ).mockResolvedValue(null);

    vi.mocked(
      paymentRepository.createPayment,
    ).mockResolvedValue(payment as never);

    vi.mocked(
      provider.createOrder,
    ).mockResolvedValue({
      providerOrderId: "rzp_order_123",
      amountMinor: 40000,
      currency: "INR",
    });

    const service = new PaymentService(
      orderRepository,
      paymentRepository,
      provider,
    );

    await expect(
      service.createPaymentForOrder({
        orderId: "order_123",
      }),
    ).rejects.toMatchObject({
      code: PaymentErrorCode.AMOUNT_MISMATCH,
      statusCode: 409,
    });

    expect(
      paymentRepository.createAttempt,
    ).not.toHaveBeenCalled();

    expect(
      paymentRepository.updateProviderOrderId,
    ).not.toHaveBeenCalled();
  });

  it("rejects when the provider currency does not match", async () => {
    const {
      orderRepository,
      paymentRepository,
    } = createRepositories();

    const provider = createProvider();

    vi.mocked(
      orderRepository.findByIdWithItems,
    ).mockResolvedValue(order as never);

    vi.mocked(
      paymentRepository.getPaymentByOrderId,
    ).mockResolvedValue(null);

    vi.mocked(
      paymentRepository.createPayment,
    ).mockResolvedValue(payment as never);

    vi.mocked(
      provider.createOrder,
    ).mockResolvedValue({
      providerOrderId: "rzp_order_123",
      amountMinor: 50000,
      currency: "USD",
    });

    const service = new PaymentService(
      orderRepository,
      paymentRepository,
      provider,
    );

    await expect(
      service.createPaymentForOrder({
        orderId: "order_123",
      }),
    ).rejects.toMatchObject({
      code: PaymentErrorCode.CURRENCY_MISMATCH,
      statusCode: 409,
    });

    expect(
      paymentRepository.createAttempt,
    ).not.toHaveBeenCalled();

    expect(
      paymentRepository.updateProviderOrderId,
    ).not.toHaveBeenCalled();
  });

  it("converts provider failure into CREATION_FAILED", async () => {
    const {
      orderRepository,
      paymentRepository,
    } = createRepositories();

    const provider = createProvider();

    const providerError =
      new Error("Razorpay unavailable");

    vi.mocked(
      orderRepository.findByIdWithItems,
    ).mockResolvedValue(order as never);

    vi.mocked(
      paymentRepository.getPaymentByOrderId,
    ).mockResolvedValue(null);

    vi.mocked(
      paymentRepository.createPayment,
    ).mockResolvedValue(payment as never);

    vi.mocked(
      provider.createOrder,
    ).mockRejectedValue(providerError);

    const service = new PaymentService(
      orderRepository,
      paymentRepository,
      provider,
    );

    const error =
      await expect(
        service.createPaymentForOrder({
          orderId: "order_123",
        }),
      ).rejects.toBeInstanceOf(PaymentError);

    expect(error).toBeDefined();

    await expect(
      service.createPaymentForOrder({
        orderId: "order_123",
      }),
    ).rejects.toMatchObject({
      code: PaymentErrorCode.CREATION_FAILED,
      statusCode: 502,
      message:
        "Failed to create payment with provider.",
    });
  });

  it("rejects payment creation when the order does not exist", async () => {
    const {
      orderRepository,
      paymentRepository,
    } = createRepositories();

    const provider = createProvider();

    vi.mocked(
      orderRepository.findByIdWithItems,
    ).mockResolvedValue(null);

    const service = new PaymentService(
      orderRepository,
      paymentRepository,
      provider,
    );

    await expect(
      service.createPaymentForOrder({
        orderId: "missing_order",
      }),
    ).rejects.toMatchObject({
      message: "Order not found.",
      statusCode: 404,
      code: "ORDER_NOT_FOUND",
    });

    expect(
      paymentRepository.createPayment,
    ).not.toHaveBeenCalled();

    expect(
      provider.createOrder,
    ).not.toHaveBeenCalled();
  });

  it("rejects creation when a payment already exists", async () => {
    const {
      orderRepository,
      paymentRepository,
    } = createRepositories();

    const provider = createProvider();

    vi.mocked(
      orderRepository.findByIdWithItems,
    ).mockResolvedValue(order as never);

    vi.mocked(
      paymentRepository.getPaymentByOrderId,
    ).mockResolvedValue(payment as never);

    const service = new PaymentService(
      orderRepository,
      paymentRepository,
      provider,
    );

    await expect(
      service.createPaymentForOrder({
        orderId: "order_123",
      }),
    ).rejects.toMatchObject({
      code: PaymentErrorCode.ALREADY_EXISTS,
      statusCode: 409,
    });

    expect(
      paymentRepository.createPayment,
    ).not.toHaveBeenCalled();

    expect(
      provider.createOrder,
    ).not.toHaveBeenCalled();
  });

  it("rejects creation for an invalid order state", async () => {
    const {
      orderRepository,
      paymentRepository,
    } = createRepositories();

    const provider = createProvider();

    vi.mocked(
      orderRepository.findByIdWithItems,
    ).mockResolvedValue({
      ...order,
      status: "CANCELLED",
    } as never);

    const service = new PaymentService(
      orderRepository,
      paymentRepository,
      provider,
    );

    await expect(
      service.createPaymentForOrder({
        orderId: "order_123",
      }),
    ).rejects.toMatchObject({
      code: PaymentErrorCode.INVALID_STATE,
      statusCode: 409,
    });

    expect(
      paymentRepository.createPayment,
    ).not.toHaveBeenCalled();

    expect(
      provider.createOrder,
    ).not.toHaveBeenCalled();
  });
});

describe("PaymentService - getPaymentStatusForCustomer", () => {
  function createRepositories() {
    return {
      orderRepository: {
        findByIdWithItems: vi.fn(),
      },
      paymentRepository: {
        getPaymentById: vi.fn(),
      },
    };
  }

  function createProvider(): PaymentProvider {
    return {
      name: "RAZORPAY",
      createOrder: vi.fn(),
      getPayment: vi.fn(),
      verifyPayment: vi.fn(),
      capturePayment: vi.fn(),
      refundPayment: vi.fn(),
    };
  }

  const payment = {
    id: "pay_internal_123",
    orderId: "ord_123",
    provider: "RAZORPAY",
    providerOrderId: "order_rzp_123",
    providerPaymentId: "pay_rzp_123",
    amountMinor: 6949800,
    currency: "INR",
    status: "CAPTURED",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const order = {
    id: "ord_123",
    orderNumber: "ORD-123",
    customerId: "customer-a",
    status: "PAID",
    currency: "INR",
    subtotalMinor: 6949800,
    totalMinor: 6949800,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [],
  };

  it("returns only the frontend-safe payment status fields", async () => {
    const {
      orderRepository,
      paymentRepository,
    } = createRepositories();

    paymentRepository.getPaymentById.mockResolvedValue(payment);
    orderRepository.findByIdWithItems.mockResolvedValue(order);

    const service = new PaymentService(
      orderRepository as any,
      paymentRepository as any,
      createProvider(),
    );

    await expect(
      service.getPaymentStatusForCustomer(
        payment.id,
        order.customerId,
      ),
    ).resolves.toEqual({
      id: "pay_internal_123",
      orderId: "ord_123",
      status: "CAPTURED",
      amount: 6949800,
      currency: "INR",
    });
  });

  it("rejects payment status lookup for another customer", async () => {
    const {
      orderRepository,
      paymentRepository,
    } = createRepositories();

    paymentRepository.getPaymentById.mockResolvedValue(payment);
    orderRepository.findByIdWithItems.mockResolvedValue(order);

    const service = new PaymentService(
      orderRepository as any,
      paymentRepository as any,
      createProvider(),
    );

    await expect(
      service.getPaymentStatusForCustomer(
        payment.id,
        "customer-b",
      ),
    ).rejects.toMatchObject({
      code: PaymentErrorCode.OWNERSHIP_MISMATCH,
      statusCode: 403,
    });
  });

  it("rejects payment status lookup for a missing payment", async () => {
    const {
      orderRepository,
      paymentRepository,
    } = createRepositories();

    paymentRepository.getPaymentById.mockResolvedValue(null);

    const service = new PaymentService(
      orderRepository as any,
      paymentRepository as any,
      createProvider(),
    );

    await expect(
      service.getPaymentStatusForCustomer(
        "missing-payment",
        "customer-a",
      ),
    ).rejects.toMatchObject({
      code: PaymentErrorCode.NOT_FOUND,
      statusCode: 404,
    });

    expect(
      orderRepository.findByIdWithItems,
    ).not.toHaveBeenCalled();
  });

  it("rejects payment status lookup when the backing order is missing", async () => {
    const {
      orderRepository,
      paymentRepository,
    } = createRepositories();

    paymentRepository.getPaymentById.mockResolvedValue(payment);
    orderRepository.findByIdWithItems.mockResolvedValue(null);

    const service = new PaymentService(
      orderRepository as any,
      paymentRepository as any,
      createProvider(),
    );

    await expect(
      service.getPaymentStatusForCustomer(
        payment.id,
        order.customerId,
      ),
    ).rejects.toMatchObject({
      code: "ORDER_NOT_FOUND",
      statusCode: 404,
    });
  });
});

describe("PaymentService - processRazorpayWebhook", () => {
  function createRepositories() {
    return {
      orderRepository: {
        findByIdWithItems: vi.fn(),
        update: vi.fn(),
      },
      paymentRepository: {
        findByProviderPaymentId: vi.fn(),
        findByProviderOrderId: vi.fn(),
        updateProviderPaymentStatus:
          vi.fn(),
        updatePaymentStatus: vi.fn(),
        getPaymentById: vi.fn(),
      },
    };
  }

  function createProvider(): PaymentProvider {
    return {
      name: "RAZORPAY",
      createOrder: vi.fn(),
      getPayment: vi.fn(),
      verifyPayment: vi.fn(),
      capturePayment: vi.fn(),
      refundPayment: vi.fn(),
    };
  }

  const payment = {
    id: "pay_internal_123",
    orderId: "ord_123",
    provider: "RAZORPAY",
    providerOrderId: "order_rzp_123",
    providerPaymentId: null,
    amountMinor: 6949800,
    currency: "INR",
    status: "PENDING",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const order = {
    id: "ord_123",
    orderNumber: "ORD-123",
    customerId: "customer-a",
    status: "PAYMENT_PENDING",
    currency: "INR",
    subtotalMinor: 6949800,
    totalMinor: 6949800,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [],
  };

  const paymentEntity = {
    id: "pay_rzp_123",
    order_id: "order_rzp_123",
    amount: 6949800,
    currency: "INR",
    status: "authorized",
  };

  it("captures a late authorized Razorpay payment", async () => {
    const {
      orderRepository,
      paymentRepository,
    } = createRepositories();
    const provider = createProvider();

    paymentRepository.findByProviderPaymentId.mockResolvedValue(null);
    paymentRepository.findByProviderOrderId.mockResolvedValue(payment);
    orderRepository.findByIdWithItems.mockResolvedValue(order);
    paymentRepository.updateProviderPaymentStatus.mockResolvedValue({
      ...payment,
      providerPaymentId: paymentEntity.id,
      status: "AUTHORIZED",
    });
    paymentRepository.getPaymentById.mockResolvedValue({
      ...payment,
      providerPaymentId: paymentEntity.id,
      status: "AUTHORIZED",
    });
    provider.capturePayment = vi
      .fn()
      .mockResolvedValue({
        providerPaymentId: paymentEntity.id,
        providerOrderId:
          paymentEntity.order_id,
        amountMinor: paymentEntity.amount,
        currency: paymentEntity.currency,
        status: "captured",
      });
    paymentRepository.updatePaymentStatus.mockResolvedValue({
      ...payment,
      providerPaymentId: paymentEntity.id,
      status: "CAPTURED",
    });
    orderRepository.update.mockResolvedValue({
      ...order,
      status: "PAID",
    });

    const service = new PaymentService(
      orderRepository as any,
      paymentRepository as any,
      provider,
    );

    await expect(
      service.processRazorpayWebhook({
        event: "payment.authorized",
        payload: {
          payment: {
            entity: paymentEntity,
          },
        },
      }),
    ).resolves.toMatchObject({
      event: "payment.authorized",
      processed: true,
      paymentId: payment.id,
      orderId: order.id,
    });

    expect(
      paymentRepository.updateProviderPaymentStatus,
    ).toHaveBeenCalledWith({
      id: payment.id,
      providerPaymentId: paymentEntity.id,
      status: "AUTHORIZED",
    });
    expect(provider.capturePayment).toHaveBeenCalledWith({
      providerPaymentId: paymentEntity.id,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
    });
  });

  it("marks captured Razorpay payment webhooks as paid", async () => {
    const {
      orderRepository,
      paymentRepository,
    } = createRepositories();
    const provider = createProvider();

    paymentRepository.findByProviderPaymentId.mockResolvedValue(null);
    paymentRepository.findByProviderOrderId.mockResolvedValue(payment);
    orderRepository.findByIdWithItems.mockResolvedValue(order);
    paymentRepository.updateProviderPaymentStatus.mockResolvedValue({
      ...payment,
      providerPaymentId: paymentEntity.id,
      status: "CAPTURED",
    });

    const service = new PaymentService(
      orderRepository as any,
      paymentRepository as any,
      provider,
    );

    await service.processRazorpayWebhook({
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            ...paymentEntity,
            status: "captured",
          },
        },
      },
    });

    expect(
      paymentRepository.updateProviderPaymentStatus,
    ).toHaveBeenCalledWith({
      id: payment.id,
      providerPaymentId: paymentEntity.id,
      status: "CAPTURED",
    });
    expect(orderRepository.update).toHaveBeenCalledWith(
      order.id,
      { status: "PAID" },
    );
  });

  it("does not downgrade a captured payment from a failed webhook", async () => {
    const {
      orderRepository,
      paymentRepository,
    } = createRepositories();
    const provider = createProvider();
    const capturedPayment = {
      ...payment,
      providerPaymentId: paymentEntity.id,
      status: "CAPTURED",
    };

    paymentRepository.findByProviderPaymentId.mockResolvedValue(
      capturedPayment,
    );
    orderRepository.findByIdWithItems.mockResolvedValue({
      ...order,
      status: "PAID",
    });

    const service = new PaymentService(
      orderRepository as any,
      paymentRepository as any,
      provider,
    );

    await service.processRazorpayWebhook({
      event: "payment.failed",
      payload: {
        payment: {
          entity: {
            ...paymentEntity,
            status: "failed",
          },
        },
      },
    });

    expect(
      paymentRepository.updateProviderPaymentStatus,
    ).not.toHaveBeenCalled();
    expect(orderRepository.update).not.toHaveBeenCalled();
  });

  it("marks the internal order paid from order.paid", async () => {
    const {
      orderRepository,
      paymentRepository,
    } = createRepositories();
    const provider = createProvider();

    paymentRepository.findByProviderOrderId.mockResolvedValue(payment);
    orderRepository.findByIdWithItems.mockResolvedValue(order);
    paymentRepository.updatePaymentStatus.mockResolvedValue({
      ...payment,
      status: "CAPTURED",
    });

    const service = new PaymentService(
      orderRepository as any,
      paymentRepository as any,
      provider,
    );

    await service.processRazorpayWebhook({
      event: "order.paid",
      payload: {
        order: {
          entity: {
            id: payment.providerOrderId,
            status: "paid",
            amount_paid:
              payment.amountMinor,
            currency: payment.currency,
          },
        },
      },
    });

    expect(
      paymentRepository.updatePaymentStatus,
    ).toHaveBeenCalledWith(
      payment.id,
      "CAPTURED",
    );
    expect(orderRepository.update).toHaveBeenCalledWith(
      order.id,
      { status: "PAID" },
    );
  });
});

describe("PaymentService - verifyCheckoutPayment", () => {
  function createRepositories() {
    return {
      orderRepository: {
        findByIdWithItems: vi.fn(),
        update: vi.fn(),
      },
      paymentRepository: {
        getPaymentById: vi.fn(),
        findByProviderPaymentId: vi.fn(),
        markVerified: vi.fn(),
        updatePaymentStatus: vi.fn(),
      },
    };
  }

  function createProvider() {
    return {
      name: "RAZORPAY" as const,
      createOrder: vi.fn(),
      getPayment: vi.fn(),
      verifyPayment: vi.fn(),
      capturePayment: vi.fn(),
      refundPayment: vi.fn(),
    };
  }

  const order = {
    id: "order-1",
    customerId: "customer-1",
    totalMinor: 6949800,
    currency: "INR",
    status: "PAYMENT_PENDING",
    items: [],
  };

  const payment = {
    id: "payment-1",
    orderId: order.id,
    providerOrderId: "order_rzp_1",
    providerPaymentId: null,
    amountMinor: 6949800,
    currency: "INR",
    status: "PENDING",
  };

  const verifyInput = {
    paymentId: payment.id,
    customerId: order.customerId,
    razorpayPaymentId: "pay_rzp_1",
    razorpayOrderId: payment.providerOrderId,
    razorpaySignature: "signature",
  };

  it("marks the payment and order paid only after full verification", async () => {
    const {
      orderRepository,
      paymentRepository,
    } = createRepositories();
    const provider = createProvider();
    const auditService = {
      record: vi.fn(),
    };

    const authorizedPayment = {
      ...payment,
      providerPaymentId: verifyInput.razorpayPaymentId,
      status: "AUTHORIZED",
    };
    const capturedPayment = {
      ...authorizedPayment,
      status: "CAPTURED",
    };

    paymentRepository.getPaymentById
      .mockResolvedValueOnce(payment)
      .mockResolvedValueOnce(authorizedPayment);
    orderRepository.findByIdWithItems.mockResolvedValue(order);
    paymentRepository.findByProviderPaymentId.mockResolvedValue(null);
    provider.verifyPayment.mockResolvedValue({
      verified: true,
      providerPaymentId: verifyInput.razorpayPaymentId,
      providerOrderId: verifyInput.razorpayOrderId,
    });
    provider.getPayment.mockResolvedValue({
      providerPaymentId: verifyInput.razorpayPaymentId,
      providerOrderId: verifyInput.razorpayOrderId,
      amountMinor: 6949800,
      currency: "INR",
      status: "authorized",
    });
    paymentRepository.markVerified.mockResolvedValue({
      ...authorizedPayment,
    });
    provider.capturePayment.mockResolvedValue({
      providerPaymentId: verifyInput.razorpayPaymentId,
      providerOrderId: verifyInput.razorpayOrderId,
      amountMinor: 6949800,
      currency: "INR",
      status: "captured",
    });
    paymentRepository.updatePaymentStatus.mockResolvedValue(
      capturedPayment,
    );
    orderRepository.update.mockResolvedValue({
      ...order,
      status: "PAID",
    });

    const service = new PaymentService(
      orderRepository as any,
      paymentRepository as any,
      provider,
      auditService,
    );

    const result =
      await service.verifyCheckoutPayment(verifyInput);

    expect(result.verified).toBe(true);
    expect(
      provider.verifyPayment,
    ).toHaveBeenCalledWith({
      providerOrderId: verifyInput.razorpayOrderId,
      providerPaymentId: verifyInput.razorpayPaymentId,
      signature: verifyInput.razorpaySignature,
    });
    expect(provider.getPayment).toHaveBeenCalledWith({
      providerPaymentId: verifyInput.razorpayPaymentId,
    });
    expect(
      paymentRepository.markVerified,
    ).toHaveBeenCalledWith({
      id: payment.id,
      providerPaymentId: verifyInput.razorpayPaymentId,
      status: "AUTHORIZED",
    });
    expect(provider.capturePayment).toHaveBeenCalledWith({
      providerPaymentId: verifyInput.razorpayPaymentId,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
    });
    expect(
      paymentRepository.updatePaymentStatus,
    ).toHaveBeenCalledWith(
      payment.id,
      "CAPTURED",
    );
    expect(orderRepository.update).toHaveBeenCalledWith(
      order.id,
      { status: "PAID" },
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "PAYMENT_AUTHORIZED",
        paymentId: payment.id,
        orderId: order.id,
        customerId: order.customerId,
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "PAYMENT_CAPTURED",
        paymentId: payment.id,
        orderId: order.id,
        customerId: order.customerId,
      }),
    );
  });

  it("rejects verification for a different customer", async () => {
    const {
      orderRepository,
      paymentRepository,
    } = createRepositories();
    const provider = createProvider();

    paymentRepository.getPaymentById.mockResolvedValue(payment);
    orderRepository.findByIdWithItems.mockResolvedValue(order);

    const service = new PaymentService(
      orderRepository as any,
      paymentRepository as any,
      provider,
    );

    await expect(
      service.verifyCheckoutPayment({
        ...verifyInput,
        customerId: "customer-2",
      }),
    ).rejects.toMatchObject({
      code: PaymentErrorCode.OWNERSHIP_MISMATCH,
      statusCode: 403,
    });

    expect(
      provider.verifyPayment,
    ).not.toHaveBeenCalled();
    expect(
      paymentRepository.markVerified,
    ).not.toHaveBeenCalled();
  });

  it("rejects a mismatched Razorpay order ID", async () => {
    const {
      orderRepository,
      paymentRepository,
    } = createRepositories();
    const provider = createProvider();

    paymentRepository.getPaymentById.mockResolvedValue(payment);
    orderRepository.findByIdWithItems.mockResolvedValue(order);

    const service = new PaymentService(
      orderRepository as any,
      paymentRepository as any,
      provider,
    );

    await expect(
      service.verifyCheckoutPayment({
        ...verifyInput,
        razorpayOrderId: "order_other",
      }),
    ).rejects.toMatchObject({
      code: PaymentErrorCode.ORDER_MISMATCH,
      statusCode: 409,
    });

    expect(
      provider.verifyPayment,
    ).not.toHaveBeenCalled();
  });

  it("does not mark paid when the signature is invalid", async () => {
    const {
      orderRepository,
      paymentRepository,
    } = createRepositories();
    const provider = createProvider();
    const auditService = {
      record: vi.fn(),
    };

    paymentRepository.getPaymentById.mockResolvedValue(payment);
    orderRepository.findByIdWithItems.mockResolvedValue(order);
    paymentRepository.findByProviderPaymentId.mockResolvedValue(null);
    provider.verifyPayment.mockResolvedValue({
      verified: false,
      providerPaymentId: verifyInput.razorpayPaymentId,
      providerOrderId: verifyInput.razorpayOrderId,
    });

    const service = new PaymentService(
      orderRepository as any,
      paymentRepository as any,
      provider,
      auditService,
    );

    const result =
      await service.verifyCheckoutPayment(verifyInput);

    expect(result.verified).toBe(false);
    expect(provider.getPayment).not.toHaveBeenCalled();
    expect(
      paymentRepository.markVerified,
    ).not.toHaveBeenCalled();
    expect(orderRepository.update).not.toHaveBeenCalled();
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "PAYMENT_VERIFICATION_FAILED",
      }),
    );
  });

  it("rejects a provider payment amount mismatch", async () => {
    const {
      orderRepository,
      paymentRepository,
    } = createRepositories();
    const provider = createProvider();

    paymentRepository.getPaymentById.mockResolvedValue(payment);
    orderRepository.findByIdWithItems.mockResolvedValue(order);
    paymentRepository.findByProviderPaymentId.mockResolvedValue(null);
    provider.verifyPayment.mockResolvedValue({
      verified: true,
      providerPaymentId: verifyInput.razorpayPaymentId,
      providerOrderId: verifyInput.razorpayOrderId,
    });
    provider.getPayment.mockResolvedValue({
      providerPaymentId: verifyInput.razorpayPaymentId,
      providerOrderId: verifyInput.razorpayOrderId,
      amountMinor: 6948800,
      currency: "INR",
      status: "captured",
    });

    const service = new PaymentService(
      orderRepository as any,
      paymentRepository as any,
      provider,
    );

    await expect(
      service.verifyCheckoutPayment(verifyInput),
    ).rejects.toMatchObject({
      code: PaymentErrorCode.AMOUNT_MISMATCH,
      statusCode: 409,
    });

    expect(
      paymentRepository.markVerified,
    ).not.toHaveBeenCalled();
    expect(orderRepository.update).not.toHaveBeenCalled();
  });

  it("rejects a provider payment currency mismatch", async () => {
    const {
      orderRepository,
      paymentRepository,
    } = createRepositories();
    const provider = createProvider();

    paymentRepository.getPaymentById.mockResolvedValue(payment);
    orderRepository.findByIdWithItems.mockResolvedValue(order);
    paymentRepository.findByProviderPaymentId.mockResolvedValue(null);
    provider.verifyPayment.mockResolvedValue({
      verified: true,
      providerPaymentId: verifyInput.razorpayPaymentId,
      providerOrderId: verifyInput.razorpayOrderId,
    });
    provider.getPayment.mockResolvedValue({
      providerPaymentId: verifyInput.razorpayPaymentId,
      providerOrderId: verifyInput.razorpayOrderId,
      amountMinor: 6949800,
      currency: "USD",
      status: "captured",
    });

    const service = new PaymentService(
      orderRepository as any,
      paymentRepository as any,
      provider,
    );

    await expect(
      service.verifyCheckoutPayment(verifyInput),
    ).rejects.toMatchObject({
      code: PaymentErrorCode.CURRENCY_MISMATCH,
      statusCode: 409,
    });

    expect(
      paymentRepository.markVerified,
    ).not.toHaveBeenCalled();
    expect(orderRepository.update).not.toHaveBeenCalled();
  });

  it("captures an authorized payment through the provider", async () => {
    const {
      orderRepository,
      paymentRepository,
    } = createRepositories();
    const provider = createProvider();

    const authorizedPayment = {
      ...payment,
      providerPaymentId: verifyInput.razorpayPaymentId,
      status: "AUTHORIZED",
    };
    const capturedPayment = {
      ...authorizedPayment,
      status: "CAPTURED",
    };

    paymentRepository.getPaymentById.mockResolvedValue(
      authorizedPayment,
    );
    orderRepository.findByIdWithItems.mockResolvedValue(order);
    provider.capturePayment.mockResolvedValue({
      providerPaymentId: verifyInput.razorpayPaymentId,
      providerOrderId: verifyInput.razorpayOrderId,
      amountMinor: 6949800,
      currency: "INR",
      status: "captured",
    });
    paymentRepository.updatePaymentStatus.mockResolvedValue(
      capturedPayment,
    );
    orderRepository.update.mockResolvedValue({
      ...order,
      status: "PAID",
    });

    const service = new PaymentService(
      orderRepository as any,
      paymentRepository as any,
      provider,
    );

    const result =
      await service.captureAuthorizedPayment({
        paymentId: payment.id,
        customerId: order.customerId,
      });

    expect(result.captured).toBe(true);
    expect(result.payment?.status).toBe("CAPTURED");
    expect(provider.capturePayment).toHaveBeenCalledWith({
      providerPaymentId: verifyInput.razorpayPaymentId,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
    });
    expect(orderRepository.update).toHaveBeenCalledWith(
      order.id,
      { status: "PAID" },
    );
  });

  it("does not recapture an already captured payment", async () => {
    const {
      orderRepository,
      paymentRepository,
    } = createRepositories();
    const provider = createProvider();

    const capturedPayment = {
      ...payment,
      providerPaymentId: verifyInput.razorpayPaymentId,
      status: "CAPTURED",
    };

    paymentRepository.getPaymentById.mockResolvedValue(
      capturedPayment,
    );
    orderRepository.findByIdWithItems.mockResolvedValue(order);

    const service = new PaymentService(
      orderRepository as any,
      paymentRepository as any,
      provider,
    );

    const result =
      await service.captureAuthorizedPayment({
        paymentId: payment.id,
        customerId: order.customerId,
      });

    expect(result.captured).toBe(true);
    expect(provider.capturePayment).not.toHaveBeenCalled();
  });

  it("rejects capture when the payment is not authorized", async () => {
    const {
      orderRepository,
      paymentRepository,
    } = createRepositories();
    const provider = createProvider();

    paymentRepository.getPaymentById.mockResolvedValue({
      ...payment,
      status: "PENDING",
      providerPaymentId: verifyInput.razorpayPaymentId,
    });
    orderRepository.findByIdWithItems.mockResolvedValue(order);

    const service = new PaymentService(
      orderRepository as any,
      paymentRepository as any,
      provider,
    );

    await expect(
      service.captureAuthorizedPayment({
        paymentId: payment.id,
        customerId: order.customerId,
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "INVALID_PAYMENT_STATUS_TRANSITION",
    });

    expect(provider.capturePayment).not.toHaveBeenCalled();
  });

  it("marks capture as failed when the provider capture fails", async () => {
    const {
      orderRepository,
      paymentRepository,
    } = createRepositories();
    const provider = createProvider();

    paymentRepository.getPaymentById.mockResolvedValue({
      ...payment,
      status: "AUTHORIZED",
      providerPaymentId: verifyInput.razorpayPaymentId,
    });
    orderRepository.findByIdWithItems.mockResolvedValue(order);
    provider.capturePayment.mockRejectedValue(
      new Error("Razorpay unavailable"),
    );
    paymentRepository.updatePaymentStatus.mockResolvedValue({
      ...payment,
      status: "FAILED",
      providerPaymentId: verifyInput.razorpayPaymentId,
    });

    const service = new PaymentService(
      orderRepository as any,
      paymentRepository as any,
      provider,
    );

    await expect(
      service.captureAuthorizedPayment({
        paymentId: payment.id,
        customerId: order.customerId,
      }),
    ).rejects.toMatchObject({
      code: PaymentErrorCode.CAPTURE_FAILED,
      statusCode: 502,
    });

    expect(
      paymentRepository.updatePaymentStatus,
    ).toHaveBeenCalledWith(
      payment.id,
      "FAILED",
    );
  });
});
