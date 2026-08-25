import { randomUUID } from "node:crypto";

export function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const suffix = randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();

  return `ORD-${timestamp}-${suffix}`;
}