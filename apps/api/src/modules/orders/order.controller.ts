import type {
  Request,
  Response,
  NextFunction,
} from "express";
import { createHash } from "node:crypto";

import { AppError } from "../../middleware/error-handler.js";
import { createOrderSchema } from "./order.schemas.js";
import { OrderService } from "./order.service.js";
import { IdempotencyService } from "../../lib/idempotency/idempotency.service.js";
import {
  type OrderStatus,
} from "./order-state-machine.js";

export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  private buildRequestHash(input: {
    customerId: string;
    cartId: string;
  }): string {
    const normalized = JSON.stringify({
      customerId: input.customerId,
      cartId: input.cartId,
    });

    return createHash("sha256")
      .update(normalized)
      .digest("hex");
  }

  createOrder = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    let idempotencyKey: string | undefined;
    let requestHash: string | undefined;

    try {
      const input = createOrderSchema.parse(
        req.body,
      );

      idempotencyKey =
        req.header("Idempotency-Key")?.trim();

      if (!idempotencyKey) {
        const order =
          await this.orderService.createOrderFromCart(
            input.customerId,
            input.cartId,
          );

        res.status(201).json({
          data: order,
        });

        return;
      }

      requestHash =
        this.buildRequestHash(input);

      const acquired =
        await this.idempotencyService.acquire(
          "orders:create",
          idempotencyKey,
          requestHash,
        );

      if (!acquired) {
        const existing =
          await this.idempotencyService.get(
            "orders:create",
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
            data: existing.response,
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
        const order =
          await this.orderService.createOrderFromCart(
            input.customerId,
            input.cartId,
          );

        await this.idempotencyService.complete(
          "orders:create",
          idempotencyKey,
          requestHash,
          order,
        );

        res.status(201).json({
          data: order,
        });
      } catch (error) {
        await this.idempotencyService.fail(
          "orders:create",
          idempotencyKey,
          requestHash,
        );

        throw error;
      }
    } catch (error) {
      next(error);
    }
  };

  cancelOrder = async (
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
        "Order ID is required.",
        400,
        "ORDER_ID_REQUIRED",
      );
    }

    const order =
      await this.orderService.cancelOrder(id);

    res.status(200).json({
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

  getOrder = async (
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
          "Order ID is required.",
          400,
          "ORDER_ID_REQUIRED",
        );
      }

      const order =
        await this.orderService.getOrderById(id);

      if (!order) {
        throw new AppError(
          "Order not found.",
          404,
          "ORDER_NOT_FOUND",
        );
      }

      res.status(200).json({
        data: order,
      });
    } catch (error) {
      next(error);
    }
  };

  transitionOrderStatus = async (
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
          "Order ID is required.",
          400,
          "ORDER_ID_REQUIRED",
        );
      }

      const { status } = req.body as {
        status?: OrderStatus;
      };

      if (!status) {
        throw new AppError(
          "Order status is required.",
          400,
          "ORDER_STATUS_REQUIRED",
        );
      }

      const order =
        await this.orderService.transitionOrderStatus(
          id,
          status,
        );

      res.status(200).json({
        data: order,
      });
    } catch (error) {
      next(error);
    }
  };

  transitionOrder = async (
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
        "Order ID is required.",
        400,
        "ORDER_ID_REQUIRED",
      );
    }

    const nextStatus = req.body?.status;

    const validStatuses = [
      "CREATED",
      "PAYMENT_PENDING",
      "PAID",
      "PROCESSING",
      "COMPLETED",
      "PAYMENT_FAILED",
      "CANCELLED",
      "REFUND_PENDING",
      "REFUNDED",
    ] as const;

    if (
      typeof nextStatus !== "string" ||
      !validStatuses.includes(
        nextStatus as (typeof validStatuses)[number],
      )
    ) {
      throw new AppError(
        "Invalid order status.",
        400,
        "INVALID_ORDER_STATUS",
      );
    }

    const order =
      await this.orderService.transitionOrder(
        id,
        nextStatus as OrderStatus,
      );

    res.status(200).json({
      data: order,
    });
  } catch (error) {
    next(error);
  }
};
}