import type { NextFunction, Request, Response } from "express";
import { createHash } from "node:crypto";
import type { Redis } from "ioredis";
import { IdempotencyService } from "../lib/idempotency/idempotency.service.js";

const DEFAULT_PROCESSING_TTL_SECONDS = 300;
const DEFAULT_COMPLETED_TTL_SECONDS = 86400;

export interface IdempotencyOptions {
  scope: string;
  redis: Redis;
  getRequestFingerprint?: (req: Request) => unknown;
}

function hashRequest(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

function getIdempotencyKey(req: Request): string | null {
  const value = req.header("Idempotency-Key");

  if (!value) {
    return null;
  }

  const key = value.trim();

  return key.length > 0 ? key : null;
}

export function idempotency(
  options: IdempotencyOptions,
) {
  const service = new IdempotencyService(options.redis);

  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const idempotencyKey = getIdempotencyKey(req);

    /*
     * Idempotency is only applied when the client provides
     * an Idempotency-Key.
     *
     * This keeps the middleware reusable for endpoints where
     * the key is optional.
     */
    if (!idempotencyKey) {
      next();
      return;
    }

    const fingerprintInput =
      options.getRequestFingerprint
        ? options.getRequestFingerprint(req)
        : req.body;

    const requestHash = hashRequest(
      fingerprintInput,
    );

    const acquired = await service.acquire(
      options.scope,
      idempotencyKey,
      requestHash,
      DEFAULT_PROCESSING_TTL_SECONDS,
    );

    if (!acquired) {
      const existing = await service.get(
        options.scope,
        idempotencyKey,
      );

      /*
       * Extremely defensive case:
       * the Redis key disappeared between acquire()
       * and get().
       */
      if (!existing) {
        res.status(409).json({
          error: "IDEMPOTENCY_RETRY",
          message:
            "The idempotency key is currently being processed. Please retry.",
        });
        return;
      }

      /*
       * Same key but different request.
       */
      if (existing.requestHash !== requestHash) {
        res.status(409).json({
          error: "PAYMENT_IDEMPOTENCY_CONFLICT",
          message:
            "The idempotency key has already been used with a different request.",
        });
        return;
      }

      /*
       * Same request is still being processed.
       */
      if (existing.status === "PROCESSING") {
        res.status(409).json({
          error: "IDEMPOTENCY_REQUEST_IN_PROGRESS",
          message:
            "A request with this idempotency key is already being processed.",
        });
        return;
      }

      /*
       * Same request already completed.
       *
       * Return the exact logical response that was produced
       * by the first request.
       */
      if (existing.status === "COMPLETED") {
        const savedResponse = existing.response as
          | {
              statusCode?: number;
              body?: unknown;
            }
          | undefined;

        if (!savedResponse) {
          res.status(409).json({
            error: "IDEMPOTENCY_RESPONSE_MISSING",
            message:
              "The previous idempotent response could not be recovered.",
          });
          return;
        }

        res
          .status(savedResponse.statusCode ?? 200)
          .json(savedResponse.body);

        return;
      }

      /*
       * A failed request is replayed as the original response.
       */
      if (existing.status === "FAILED") {
        const savedResponse = existing.response as
          | {
              statusCode?: number;
              body?: unknown;
            }
          | undefined;

        if (savedResponse) {
          res
            .status(savedResponse.statusCode ?? 500)
            .json(savedResponse.body);

          return;
        }

        res.status(500).json({
          error: "IDEMPOTENT_REQUEST_FAILED",
          message:
            "The previous request failed.",
        });

        return;
      }

      next();
      return;
    }

    /*
     * First request owns this idempotency key.
     *
     * Capture the response so retries can receive exactly
     * the same logical result.
     */
    const originalJson = res.json.bind(res);
    let responseHandled = false;

    res.json = ((body: unknown) => {
      if (responseHandled) {
        return res;
      }

      responseHandled = true;

      const response = {
        statusCode: res.statusCode,
        body,
      };

      const statusCode = res.statusCode;

      void service.complete(
        options.scope,
        idempotencyKey,
        requestHash,
        response,
        DEFAULT_COMPLETED_TTL_SECONDS,
      );

      return originalJson(body);
    }) as typeof res.json;

    next();
  };
}