import * as crypto from "node:crypto";

import type { NextFunction, Request, Response } from "express";

import { AppError } from "../../middleware/error-handler.js";
import { PaymentService } from "../payments/payment.service.js";

import { razorpayWebhookSchema } from "./webhook.schemas.js";

export interface WebhookAuditService {
  record(event: {
    type: string;
    paymentId?: string;
    orderId?: string;
    customerId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
}

export interface WebhookEventStore {
  createReceived(event: {
    provider: "RAZORPAY";
    eventId: string;
    eventType: string;
    payload: unknown;
  }): Promise<{
    id: string;
    status: string;
    isNew: boolean;
  }>;
  markProcessing(id: string): Promise<unknown>;
  markProcessed(id: string): Promise<unknown>;
  markFailed(id: string, error: string): Promise<unknown>;
}

export class WebhookController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly razorpayWebhookSecret?: string,
    private readonly auditService?: WebhookAuditService,
    private readonly webhookEventStore?: WebhookEventStore,
  ) {}

  handleRazorpayWebhook = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!this.razorpayWebhookSecret) {
        throw new AppError(
          "Razorpay webhook secret is not configured.",
          503,
          "RAZORPAY_WEBHOOK_NOT_CONFIGURED",
        );
      }

      const signature = req.header("x-razorpay-signature");

      if (!signature) {
        throw new AppError(
          "Razorpay webhook signature is required.",
          401,
          "RAZORPAY_WEBHOOK_SIGNATURE_REQUIRED",
        );
      }

      const rawBody = Buffer.isBuffer(req.body)
        ? req.body.toString("utf8")
        : "";

      if (!rawBody) {
        throw new AppError(
          "Razorpay webhook payload is required.",
          400,
          "RAZORPAY_WEBHOOK_PAYLOAD_REQUIRED",
        );
      }

      if (!this.verifySignature(rawBody, signature)) {
        await this.auditService?.record({
          type: "RAZORPAY_WEBHOOK_SIGNATURE_INVALID",
          metadata: {
            signaturePresent: true,
            payloadSizeBytes: Buffer.byteLength(rawBody),
          },
        });

        throw new AppError(
          "Razorpay webhook signature is invalid.",
          401,
          "RAZORPAY_WEBHOOK_SIGNATURE_INVALID",
        );
      }

      const parsed = razorpayWebhookSchema.parse(JSON.parse(rawBody));

      const webhookEvent = await this.webhookEventStore?.createReceived({
        provider: "RAZORPAY",
        eventId: this.getRazorpayEventId(parsed, rawBody),
        eventType: parsed.event,
        payload: parsed,
      });

      res.status(200).json({
        data: {
          received: true,
          event: parsed.event,
          webhookEventId: webhookEvent?.id,
          status: webhookEvent?.status ?? "RECEIVED",
        },
      });

      if (webhookEvent && !webhookEvent.isNew) {
        return;
      }

      await this.processPersistedWebhook(webhookEvent?.id, parsed);
    } catch (error) {
      next(error);
    }
  };

  private verifySignature(rawBody: string, signature: string): boolean {
    const expected = crypto
      .createHmac("sha256", this.razorpayWebhookSecret ?? "")
      .update(rawBody)
      .digest("hex");

    const expectedBuffer = Buffer.from(expected, "utf8");
    const receivedBuffer = Buffer.from(signature, "utf8");

    return (
      expectedBuffer.length === receivedBuffer.length &&
      crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
    );
  }

  private async processPersistedWebhook(
    webhookEventId: string | undefined,
    payload: ReturnType<typeof razorpayWebhookSchema.parse>,
  ): Promise<void> {
    try {
      if (webhookEventId) {
        await this.webhookEventStore?.markProcessing(webhookEventId);
      }

      await this.paymentService.processRazorpayWebhook(payload);

      if (webhookEventId) {
        await this.webhookEventStore?.markProcessed(webhookEventId);
      }
    } catch (error) {
      if (webhookEventId) {
        await this.webhookEventStore?.markFailed(
          webhookEventId,
          this.formatProcessingError(error),
        );
      }
    }
  }

  private getRazorpayEventId(
    payload: ReturnType<typeof razorpayWebhookSchema.parse>,
    rawBody: string,
  ): string {
    const candidate = payload.id;

    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate;
    }

    return crypto.createHash("sha256").update(rawBody).digest("hex");
  }

  private formatProcessingError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
