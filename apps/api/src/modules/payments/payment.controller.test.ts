import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { PaymentController } from "./payment.controller.js";

describe("PaymentController - payment idempotency", () => {
  function createMocks() {
    const paymentService = {
      createPaymentForOrder: vi.fn(),
      getPaymentById: vi.fn(),
      verifyCheckoutPayment: vi.fn(),
    };

    const idempotencyService = {
      acquire: vi.fn(),
      get: vi.fn(),
      complete: vi.fn(),
      fail: vi.fn(),
    };

    const controller = new PaymentController(
      paymentService as any,
      idempotencyService as any,
    );

    return {
      controller,
      paymentService,
      idempotencyService,
    };
  }

  function createRequest(
    body: unknown,
    idempotencyKey?: string,
    params: Record<string, string> = {},
    headers: Record<string, string | undefined> = {},
  ) {
    return {
      params,
      body,
      header: vi.fn(
        (name: string) =>
          name === "Idempotency-Key"
            ? idempotencyKey
            : headers[name.toLowerCase()],
      ),
    } as any;
  }

  function createResponse() {
    const res = {
      status: vi.fn(),
      json: vi.fn(),
    };

    res.status.mockReturnValue(res);

    return res as any;
  }

  function createNext() {
    return vi.fn();
  }

  const paymentResult = {
    payment: {
      id: "payment-1",
      orderId: "order-1",
      provider: "RAZORPAY",
      providerOrderId: "rzp_order_123",
      amountMinor: 100000,
      currency: "INR",
      status: "CREATED",
    },
    providerOrder: {
      providerOrderId: "rzp_order_123",
      amountMinor: 100000,
      currency: "INR",
    },
  };

  const paymentResultWithCheckout = {
    ...paymentResult,
    checkout: {
      paymentId: "payment-1",
      razorpayOrderId: "rzp_order_123",
      amount: 100000,
      currency: "INR",
      keyId: "",
    },
  };

  it("creates a payment for a new idempotency key", async () => {
    const {
      controller,
      paymentService,
      idempotencyService,
    } = createMocks();

    const req = createRequest(
      {
        orderId: "order-1",
      },
      "PAY-ABC",
    );

    const res = createResponse();
    const next = createNext();

    idempotencyService.acquire.mockResolvedValue(
      true,
    );

    paymentService.createPaymentForOrder.mockResolvedValue(
      paymentResult,
    );

    await controller.createPayment(
      req,
      res,
      next,
    );

    expect(
      paymentService.createPaymentForOrder,
    ).toHaveBeenCalledWith({
      orderId: "order-1",
    });

    expect(
      idempotencyService.acquire,
    ).toHaveBeenCalledTimes(1);

    expect(
      idempotencyService.complete,
    ).toHaveBeenCalledTimes(1);

    expect(res.status).toHaveBeenCalledWith(
      201,
    );

    expect(res.json).toHaveBeenCalledWith({
      data: paymentResultWithCheckout,
    });

    expect(next).not.toHaveBeenCalled();
  });

  it("returns the stored response for the same key and same request", async () => {
    const {
      controller,
      paymentService,
      idempotencyService,
    } = createMocks();

    const req = createRequest(
      {
        orderId: "order-1",
      },
      "PAY-ABC",
    );

    const res = createResponse();
    const next = createNext();

    idempotencyService.acquire.mockResolvedValue(
      false,
    );

    idempotencyService.get.mockResolvedValue({
      status: "COMPLETED",
      createdAt: new Date().toISOString(),
      requestHash:
        "7f4f6f3e5f0e4c5f7e2f0e3d1f5e5c4f",
      response: paymentResult,
    });

    const firstAcquireHash =
      createMocks();

    void firstAcquireHash;

    idempotencyService.acquire.mockImplementation(
      async (
        _scope: string,
        _key: string,
        requestHash: string,
      ) => {
        idempotencyService.get.mockResolvedValue({
          status: "COMPLETED",
          createdAt:
            new Date().toISOString(),
          requestHash,
          response: paymentResult,
        });

        return false;
      },
    );

    await controller.createPayment(
      req,
      res,
      next,
    );

    expect(
      paymentService.createPaymentForOrder,
    ).not.toHaveBeenCalled();

    expect(res.status).toHaveBeenCalledWith(
      201,
    );

    expect(res.json).toHaveBeenCalledWith({
      data: paymentResultWithCheckout,
    });

    expect(next).not.toHaveBeenCalled();
  });

  it("rejects reuse of the same key with a different order", async () => {
    const {
      controller,
      paymentService,
      idempotencyService,
    } = createMocks();

    const req = createRequest(
      {
        orderId: "order-2",
      },
      "PAY-ABC",
    );

    const res = createResponse();
    const next = createNext();

    idempotencyService.acquire.mockResolvedValue(
      false,
    );

    idempotencyService.get.mockImplementation(
      async () => ({
        status: "COMPLETED",
        createdAt:
          new Date().toISOString(),
        requestHash:
          "different-request-hash",
        response: paymentResult,
      }),
    );

    await controller.createPayment(
      req,
      res,
      next,
    );

    expect(
      paymentService.createPaymentForOrder,
    ).not.toHaveBeenCalled();

    expect(next).toHaveBeenCalledTimes(1);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 409,
        code: "IDEMPOTENCY_KEY_REUSED",
      }),
    );
  });

  it("rejects when the identical request is already processing", async () => {
    const {
      controller,
      paymentService,
      idempotencyService,
    } = createMocks();

    const req = createRequest(
      {
        orderId: "order-1",
      },
      "PAY-ABC",
    );

    const res = createResponse();
    const next = createNext();

    idempotencyService.acquire.mockImplementation(
      async (
        _scope: string,
        _key: string,
        requestHash: string,
      ) => {
        idempotencyService.get.mockResolvedValue({
          status: "PROCESSING",
          createdAt:
            new Date().toISOString(),
          requestHash,
        });

        return false;
      },
    );

    await controller.createPayment(
      req,
      res,
      next,
    );

    expect(
      paymentService.createPaymentForOrder,
    ).not.toHaveBeenCalled();

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 409,
        code: "IDEMPOTENCY_REQUEST_IN_PROGRESS",
      }),
    );
  });

  it("rejects when the previous request failed", async () => {
    const {
      controller,
      paymentService,
      idempotencyService,
    } = createMocks();

    const req = createRequest(
      {
        orderId: "order-1",
      },
      "PAY-ABC",
    );

    const res = createResponse();
    const next = createNext();

    idempotencyService.acquire.mockImplementation(
      async (
        _scope: string,
        _key: string,
        requestHash: string,
      ) => {
        idempotencyService.get.mockResolvedValue({
          status: "FAILED",
          createdAt:
            new Date().toISOString(),
          requestHash,
        });

        return false;
      },
    );

    await controller.createPayment(
      req,
      res,
      next,
    );

    expect(
      paymentService.createPaymentForOrder,
    ).not.toHaveBeenCalled();

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 409,
        code: "IDEMPOTENCY_REQUEST_FAILED",
      }),
    );
  });

  it("marks the idempotency request as failed when payment creation fails", async () => {
    const {
      controller,
      paymentService,
      idempotencyService,
    } = createMocks();

    const req = createRequest(
      {
        orderId: "order-1",
      },
      "PAY-FAIL",
    );

    const res = createResponse();
    const next = createNext();

    const paymentError = new Error(
      "Payment creation failed.",
    );

    idempotencyService.acquire.mockResolvedValue(
      true,
    );

    paymentService.createPaymentForOrder.mockRejectedValue(
      paymentError,
    );

    await controller.createPayment(
      req,
      res,
      next,
    );

    expect(
      paymentService.createPaymentForOrder,
    ).toHaveBeenCalledWith({
      orderId: "order-1",
    });

    expect(
      idempotencyService.complete,
    ).not.toHaveBeenCalled();

    expect(
      idempotencyService.fail,
    ).toHaveBeenCalledTimes(1);

    expect(
      idempotencyService.fail,
    ).toHaveBeenCalledWith(
      "payments:create",
      "PAY-FAIL",
      expect.any(String),
    );

    expect(next).toHaveBeenCalledWith(
      paymentError,
    );
  });

  it("verifies a payment using the route payment id and authenticated customer", async () => {
    const { controller, paymentService } =
      createMocks();

    const req = createRequest(
      {
        razorpayPaymentId: "pay_123",
        razorpayOrderId: "order_123",
        razorpaySignature: "sig_123",
      },
      undefined,
      {
        paymentId: "payment-1",
      },
      {
        "x-customer-id": "customer-1",
      },
    );

    const res = createResponse();
    const next = createNext();

    paymentService.verifyCheckoutPayment.mockResolvedValue(
      {
        verified: true,
        payment: {
          id: "payment-1",
          status: "SUCCESS",
        },
      },
    );

    await controller.verifyPayment(
      req,
      res,
      next,
    );

    expect(
      paymentService.verifyCheckoutPayment,
    ).toHaveBeenCalledWith({
      paymentId: "payment-1",
      customerId: "customer-1",
      razorpayPaymentId: "pay_123",
      razorpayOrderId: "order_123",
      razorpaySignature: "sig_123",
    });

    expect(res.status).toHaveBeenCalledWith(
      200,
    );
    expect(res.json).toHaveBeenCalledWith({
      data: {
        verified: true,
        payment: {
          id: "payment-1",
          status: "SUCCESS",
        },
      },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects payment verification without customer authentication", async () => {
    const { controller, paymentService } =
      createMocks();

    const req = createRequest(
      {
        razorpayPaymentId: "pay_123",
        razorpayOrderId: "order_123",
        razorpaySignature: "sig_123",
      },
      undefined,
      {
        paymentId: "payment-1",
      },
    );

    const res = createResponse();
    const next = createNext();

    await controller.verifyPayment(
      req,
      res,
      next,
    );

    expect(
      paymentService.verifyCheckoutPayment,
    ).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        code: "AUTHENTICATION_REQUIRED",
      }),
    );
  });
});
