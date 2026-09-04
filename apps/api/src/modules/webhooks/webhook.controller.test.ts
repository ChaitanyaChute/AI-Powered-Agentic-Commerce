import * as crypto from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { WebhookController } from "./webhook.controller.js";

describe("WebhookController - Razorpay", () => {
  const webhookSecret = "webhook_test_secret";

  function sign(payload: string) {
    return crypto
      .createHmac("sha256", webhookSecret)
      .update(payload)
      .digest("hex");
  }

  function createResponse() {
    const res = {
      status: vi.fn(),
      json: vi.fn(),
    };

    res.status.mockReturnValue(res);

    return res as any;
  }

  it("verifies the raw Razorpay payload before processing", async () => {
    const paymentService = {
      processRazorpayWebhook: vi.fn().mockResolvedValue({
        event: "payment.captured",
        processed: true,
        paymentId: "pay_internal_123",
        orderId: "ord_123",
      }),
    };
    const webhookEventStore = {
      createReceived: vi.fn().mockResolvedValue({
        id: "evt_internal_123",
        status: "RECEIVED",
        isNew: true,
      }),
      markProcessing: vi.fn().mockResolvedValue(undefined),
      markProcessed: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
    };
    const controller = new WebhookController(
      paymentService as any,
      webhookSecret,
      undefined,
      webhookEventStore,
    );
    const rawPayload = JSON.stringify({
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_rzp_123",
            order_id: "order_rzp_123",
            amount: 6949800,
            currency: "INR",
            status: "captured",
          },
        },
      },
    });

    const req = {
      body: Buffer.from(rawPayload, "utf8"),
      header: vi.fn((name: string) =>
        name.toLowerCase() === "x-razorpay-signature"
          ? sign(rawPayload)
          : undefined,
      ),
    } as any;
    const res = createResponse();
    const next = vi.fn();

    await controller.handleRazorpayWebhook(req, res, next);

    expect(paymentService.processRazorpayWebhook).toHaveBeenCalledWith({
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_rzp_123",
            order_id: "order_rzp_123",
            amount: 6949800,
            currency: "INR",
            status: "captured",
          },
        },
      },
    });
    expect(webhookEventStore.createReceived).toHaveBeenCalledWith({
      provider: "RAZORPAY",
      eventId: expect.any(String),
      eventType: "payment.captured",
      payload: {
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: "pay_rzp_123",
              order_id: "order_rzp_123",
              amount: 6949800,
              currency: "INR",
              status: "captured",
            },
          },
        },
      },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      data: {
        received: true,
        event: "payment.captured",
        webhookEventId: "evt_internal_123",
        status: "RECEIVED",
      },
    });
    expect(webhookEventStore.markProcessing).toHaveBeenCalledWith(
      "evt_internal_123",
    );
    expect(webhookEventStore.markProcessed).toHaveBeenCalledWith(
      "evt_internal_123",
    );
    expect(
      webhookEventStore.createReceived.mock.invocationCallOrder[0]!,
    ).toBeLessThan(
      paymentService.processRazorpayWebhook.mock.invocationCallOrder[0]!,
    );
    expect(res.json.mock.invocationCallOrder[0]!).toBeLessThan(
      paymentService.processRazorpayWebhook.mock.invocationCallOrder[0]!,
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("marks persisted webhook events failed when processing fails", async () => {
    const paymentService = {
      processRazorpayWebhook: vi
        .fn()
        .mockRejectedValue(new Error("Payment not found")),
    };
    const webhookEventStore = {
      createReceived: vi.fn().mockResolvedValue({
        id: "evt_internal_456",
        status: "RECEIVED",
        isNew: true,
      }),
      markProcessing: vi.fn().mockResolvedValue(undefined),
      markProcessed: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
    };
    const controller = new WebhookController(
      paymentService as any,
      webhookSecret,
      undefined,
      webhookEventStore,
    );
    const rawPayload = JSON.stringify({
      id: "evt_rzp_456",
      event: "payment.failed",
      payload: {
        payment: {
          entity: {
            id: "pay_rzp_456",
            order_id: "order_rzp_456",
            amount: 1000,
            currency: "INR",
            status: "failed",
          },
        },
      },
    });

    const req = {
      body: Buffer.from(rawPayload, "utf8"),
      header: vi.fn((name: string) =>
        name.toLowerCase() === "x-razorpay-signature"
          ? sign(rawPayload)
          : undefined,
      ),
    } as any;
    const res = createResponse();
    const next = vi.fn();

    await controller.handleRazorpayWebhook(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(webhookEventStore.markProcessing).toHaveBeenCalledWith(
      "evt_internal_456",
    );
    expect(webhookEventStore.markFailed).toHaveBeenCalledWith(
      "evt_internal_456",
      "Payment not found",
    );
    expect(webhookEventStore.markProcessed).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("does not reprocess already processed webhook events", async () => {
    const paymentService = {
      processRazorpayWebhook: vi.fn(),
    };
    const webhookEventStore = {
      createReceived: vi.fn().mockResolvedValue({
        id: "evt_internal_789",
        status: "PROCESSED",
        isNew: false,
      }),
      markProcessing: vi.fn().mockResolvedValue(undefined),
      markProcessed: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
    };
    const controller = new WebhookController(
      paymentService as any,
      webhookSecret,
      undefined,
      webhookEventStore,
    );
    const rawPayload = JSON.stringify({
      id: "evt_rzp_789",
      event: "order.paid",
      payload: {
        order: {
          entity: {
            id: "order_rzp_789",
            status: "paid",
            amount_paid: 1000,
            currency: "INR",
          },
        },
      },
    });

    const req = {
      body: Buffer.from(rawPayload, "utf8"),
      header: vi.fn((name: string) =>
        name.toLowerCase() === "x-razorpay-signature"
          ? sign(rawPayload)
          : undefined,
      ),
    } as any;
    const res = createResponse();
    const next = vi.fn();

    await controller.handleRazorpayWebhook(req, res, next);

    expect(paymentService.processRazorpayWebhook).not.toHaveBeenCalled();
    expect(webhookEventStore.markProcessing).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      data: {
        received: true,
        event: "order.paid",
        webhookEventId: "evt_internal_789",
        status: "PROCESSED",
      },
    });
  });

  it("does not reprocess duplicate webhook events that are not yet processed", async () => {
    const paymentService = {
      processRazorpayWebhook: vi.fn(),
    };
    const webhookEventStore = {
      createReceived: vi.fn().mockResolvedValue({
        id: "evt_internal_duplicate",
        status: "RECEIVED",
        isNew: false,
      }),
      markProcessing: vi.fn().mockResolvedValue(undefined),
      markProcessed: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
    };
    const controller = new WebhookController(
      paymentService as any,
      webhookSecret,
      undefined,
      webhookEventStore,
    );
    const rawPayload = JSON.stringify({
      id: "evt_rzp_duplicate",
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_rzp_duplicate",
            order_id: "order_rzp_duplicate",
            amount: 1000,
            currency: "INR",
            status: "captured",
          },
        },
      },
    });

    const req = {
      body: Buffer.from(rawPayload, "utf8"),
      header: vi.fn((name: string) =>
        name.toLowerCase() === "x-razorpay-signature"
          ? sign(rawPayload)
          : undefined,
      ),
    } as any;
    const res = createResponse();
    const next = vi.fn();

    await controller.handleRazorpayWebhook(req, res, next);

    expect(paymentService.processRazorpayWebhook).not.toHaveBeenCalled();
    expect(webhookEventStore.markProcessing).not.toHaveBeenCalled();
    expect(webhookEventStore.markProcessed).not.toHaveBeenCalled();
    expect(webhookEventStore.markFailed).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects an invalid Razorpay signature", async () => {
    const paymentService = {
      processRazorpayWebhook: vi.fn(),
    };
    const auditService = {
      record: vi.fn().mockResolvedValue(undefined),
    };
    const controller = new WebhookController(
      paymentService as any,
      webhookSecret,
      auditService,
    );

    const rawPayload = JSON.stringify({
      event: "payment.captured",
      payload: {},
    });
    const req = {
      body: Buffer.from(rawPayload),
      header: vi.fn((name: string) =>
        name.toLowerCase() === "x-razorpay-signature"
          ? "invalid-signature"
          : undefined,
      ),
    } as any;
    const res = createResponse();
    const next = vi.fn();

    await controller.handleRazorpayWebhook(req, res, next);

    expect(paymentService.processRazorpayWebhook).not.toHaveBeenCalled();
    expect(auditService.record).toHaveBeenCalledWith({
      type: "RAZORPAY_WEBHOOK_SIGNATURE_INVALID",
      metadata: {
        signaturePresent: true,
        payloadSizeBytes: Buffer.byteLength(rawPayload),
      },
    });
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        code: "RAZORPAY_WEBHOOK_SIGNATURE_INVALID",
      }),
    );
  });
});
