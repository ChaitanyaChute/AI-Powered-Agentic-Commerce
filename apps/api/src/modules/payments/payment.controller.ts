import type {
  Request,
  Response,
  NextFunction,
} from "express";
import {
  createPaymentSchema,
  verifyPaymentSchema,
} from "./payment.schemas.js";
import { createHash } from "node:crypto";
import { AppError } from "../../middleware/error-handler.js";
import { IdempotencyService } from "../../lib/idempotency/idempotency.service.js";
import { PaymentService } from "./payment.service.js";
import { env } from "../../config/env.js";

export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  private buildRequestHash(input: {
    orderId: string;
  }): string {
    const normalized = JSON.stringify({
      orderId: input.orderId,
    });

    return createHash("sha256")
      .update(normalized)
      .digest("hex");
  }

  createPayment = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    let idempotencyKey: string | undefined;
    let requestHash: string | undefined;

    try {
      const input = createPaymentSchema.parse(
  req.body,
);

      idempotencyKey =
        req.header("Idempotency-Key")?.trim();

      if (!idempotencyKey) {
        const result =
          await this.paymentService.createPaymentForOrder(
            input,
          );

        res.status(201).json({
          data: {
            ...result,
            checkout: this.toCheckoutData(
              result,
            ),
          },
        });

        return;
      }

      requestHash =
        this.buildRequestHash(input);

      const acquired =
        await this.idempotencyService.acquire(
          "payments:create",
          idempotencyKey,
          requestHash,
        );

      if (!acquired) {
        const existing =
          await this.idempotencyService.get(
            "payments:create",
            idempotencyKey,
          );

        if (!existing) {
          throw new AppError(
            "Unable to resolve idempotency request.",
            409,
            "IDEMPOTENCY_CONFLICT",
          );
        }

        if (
          existing.requestHash !== requestHash
        ) {
          throw new AppError(
            "Idempotency key was already used with a different request.",
            409,
            "IDEMPOTENCY_KEY_REUSED",
          );
        }

        if (
          existing.status === "COMPLETED"
        ) {
          res.status(201).json({
            data: this.withCheckoutData(
              existing.response,
            ),
          });

          return;
        }

        if (
          existing.status === "PROCESSING"
        ) {
          throw new AppError(
            "An identical request is already being processed.",
            409,
            "IDEMPOTENCY_REQUEST_IN_PROGRESS",
          );
        }

        throw new AppError(
          "The previous request using this idempotency key failed.",
          409,
          "IDEMPOTENCY_REQUEST_FAILED",
        );
      }

      try {
        const result =
          await this.paymentService.createPaymentForOrder(
            input,
          );

        await this.idempotencyService.complete(
          "payments:create",
          idempotencyKey,
          requestHash,
          result,
        );

        res.status(201).json({
          data: {
            ...result,
            checkout: this.toCheckoutData(
              result,
            ),
          },
        });
      } catch (error) {
        await this.idempotencyService.fail(
          "payments:create",
          idempotencyKey,
          requestHash,
        );

        throw error;
      }
    } catch (error) {
      next(error);
    }
  };

  verifyPayment = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { paymentId } = req.params;

      if (
        typeof paymentId !== "string" ||
        paymentId.length === 0
      ) {
        throw new AppError(
          "Payment ID is required.",
          400,
          "PAYMENT_ID_REQUIRED",
        );
      }

      const customerId =
        req.header("x-customer-id")?.trim();

      if (!customerId) {
        throw new AppError(
          "Customer authentication is required.",
          401,
          "AUTHENTICATION_REQUIRED",
        );
      }

      const input = verifyPaymentSchema.parse(
        req.body,
      );

      const result =
        await this.paymentService.verifyCheckoutPayment(
          {
            paymentId,
            customerId,
            ...input,
          },
        );

      res.status(200).json({
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getPayment = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id } = req.params;

      if (
        typeof id !== "string" ||
        id.length === 0
      ) {
        throw new AppError(
          "Payment ID is required.",
          400,
          "PAYMENT_ID_REQUIRED",
        );
      }

      const customerId =
        req.header("x-customer-id")?.trim();

      if (!customerId) {
        throw new AppError(
          "Customer authentication is required.",
          401,
          "AUTHENTICATION_REQUIRED",
        );
      }

      const payment =
        await this.paymentService.getPaymentStatusForCustomer(
          id,
          customerId,
        );

      res.status(200).json({
        data: payment,
      });
    } catch (error) {
      next(error);
    }
  };

  private toCheckoutData(result: Awaited<
    ReturnType<
      PaymentService["createPaymentForOrder"]
    >
  >) {
    if (!result.payment) {
      throw new AppError(
        "Payment was not created.",
        500,
        "PAYMENT_NOT_CREATED",
      );
    }

    return {
      paymentId: result.payment.id,
      razorpayOrderId:
        result.providerOrder.providerOrderId,
      amount: result.providerOrder.amountMinor,
      currency: result.providerOrder.currency,
      keyId: env.RAZORPAY_KEY_ID ?? "",
    };
  }

  private withCheckoutData(response: unknown) {
    if (
      typeof response !== "object" ||
      response === null ||
      !("payment" in response) ||
      !("providerOrder" in response)
    ) {
      return response;
    }

    return {
      ...response,
      checkout: this.toCheckoutData(
        response as Awaited<
          ReturnType<
            PaymentService["createPaymentForOrder"]
          >
        >,
      ),
    };
  }
}
