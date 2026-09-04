import { Router } from "express";

import {
  OrderRepository,
  PaymentRepository,
} from "@repo/database";

import { redis } from "../../config/redis.js";
import { IdempotencyService } from "../../lib/idempotency/idempotency.service.js";
import { AuditService } from "../audit/audit.service.js";

import { PaymentController } from "./payment.controller.js";
import { PaymentService } from "./payment.service.js";
import type { PaymentProvider } from "@repo/shared";

export function createPaymentRouter(
  paymentProvider: PaymentProvider,
): Router {
  const router: Router = Router();

  const orderRepository =
    new OrderRepository();

  const paymentRepository =
    new PaymentRepository();

  const idempotencyService =
    new IdempotencyService(redis);

  const paymentService =
    new PaymentService(
      orderRepository,
      paymentRepository,
      paymentProvider,
      new AuditService(),
    );

  const paymentController =
    new PaymentController(
      paymentService,
      idempotencyService,
    );

  router.post(
    "/",
    paymentController.createPayment,
  );

  router.post(
    "/:paymentId/verify",
    paymentController.verifyPayment,
  );

  router.get(
    "/:id",
    paymentController.getPayment,
  );

  return router;
}
