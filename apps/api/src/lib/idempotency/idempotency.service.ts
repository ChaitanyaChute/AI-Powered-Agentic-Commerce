import type { Redis } from "ioredis";
import type { IdempotencyRecord } from "./idempotency.types.js";

export class IdempotencyService {
  constructor(
    private readonly redis: Redis,
  ) {}

  private buildKey(
    scope: string,
    idempotencyKey: string,
  ): string {
    return `idempotency:${scope}:${idempotencyKey}`;
  }

  async acquire(
    scope: string,
    idempotencyKey: string,
    requestHash: string,
    ttlSeconds: number = 300,
  ): Promise<boolean> {
    const key = this.buildKey(
      scope,
      idempotencyKey,
    );

    const record: IdempotencyRecord = {
      status: "PROCESSING",
      createdAt: new Date().toISOString(),
      requestHash,
    };

    const result = await this.redis.set(
      key,
      JSON.stringify(record),
      "EX",
      ttlSeconds,
      "NX",
    );

    return result === "OK";
  }

  async get(
    scope: string,
    idempotencyKey: string,
  ): Promise<IdempotencyRecord | null> {
    const key = this.buildKey(
      scope,
      idempotencyKey,
    );

    const value = await this.redis.get(key);

    if (!value) {
      return null;
    }

    return JSON.parse(
      value,
    ) as IdempotencyRecord;
  }

  async complete(
    scope: string,
    idempotencyKey: string,
    requestHash: string,
    response: unknown,
    ttlSeconds: number = 86400,
  ): Promise<void> {
    const key = this.buildKey(
      scope,
      idempotencyKey,
    );

    const record: IdempotencyRecord = {
      status: "COMPLETED",
      createdAt: new Date().toISOString(),
      requestHash,
      response,
    };

    await this.redis.set(
      key,
      JSON.stringify(record),
      "EX",
      ttlSeconds,
    );
  }

  async fail(
    scope: string,
    idempotencyKey: string,
    requestHash: string,
    response?: unknown,
    ttlSeconds: number = 300,
  ): Promise<void> {
    const key = this.buildKey(
      scope,
      idempotencyKey,
    );

    const record: IdempotencyRecord = {
      status: "FAILED",
      createdAt: new Date().toISOString(),
      requestHash,
      ...(response !== undefined
        ? { response }
        : {}),
    };

    await this.redis.set(
      key,
      JSON.stringify(record),
      "EX",
      ttlSeconds,
    );
  }
}