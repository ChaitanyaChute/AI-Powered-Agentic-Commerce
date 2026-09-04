import express, { Router } from "express";

import {
  OrderRepository,
  PaymentRepository,
  WebhookEventRepository,
} from "@repo/database";
import type { PaymentProvider } from "@repo/shared";

import { env } from "../../config/env.js";
import { AuditService } from "../audit/audit.service.js";
import { PaymentService } from "../payments/payment.service.js";

import { WebhookController } from "./webhook.controller.js";

export function createWebhookRouter(
  paymentProvider: PaymentProvider,
  webhookSecret = env.RAZORPAY_WEBHOOK_SECRET,
): Router {
  const router: Router = Router();
  const auditService = new AuditService();

  const paymentService =
    new PaymentService(
      new OrderRepository(),
      new PaymentRepository(),
      paymentProvider,
      auditService,
    );

  const webhookController =
    new WebhookController(
      paymentService,
      webhookSecret,
      auditService,
      new WebhookEventRepository(),
    );

  router.post(
    "/razorpay",
    express.raw({
      type: "application/json",
      limit: "1mb",
    }),
    webhookController.handleRazorpayWebhook,
  );

  return router;
}
