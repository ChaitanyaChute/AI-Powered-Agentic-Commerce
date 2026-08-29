import { AppError } from "../../middleware/error-handler.js";

export type OrderStatus =
  | "CREATED"
  | "PAYMENT_PENDING"
  | "PAID"
  | "PROCESSING"
  | "COMPLETED"
  | "PAYMENT_FAILED"
  | "CANCELLED"
  | "REFUND_PENDING"
  | "REFUNDED";

const allowedTransitions: Record<
  OrderStatus,
  readonly OrderStatus[]
> = {
  CREATED: ["PAYMENT_PENDING", "CANCELLED"],

  PAYMENT_PENDING: ["PAID", "PAYMENT_FAILED"],

  PAID: ["PROCESSING", "REFUND_PENDING"],

  PROCESSING: ["COMPLETED"],

  COMPLETED: [],

  PAYMENT_FAILED: [],

  CANCELLED: [],

  REFUND_PENDING: ["REFUNDED"],

  REFUNDED: [],
};

export function canTransitionOrderStatus(
  from: OrderStatus,
  to: OrderStatus,
): boolean {
  return allowedTransitions[from].includes(to);
}

export function assertValidOrderTransition(
  from: OrderStatus,
  to: OrderStatus,
): void {
  if (canTransitionOrderStatus(from, to)) {
    return;
  }

  throw new AppError(
    `Invalid order status transition from ${from} to ${to}.`,
    409,
    "INVALID_ORDER_STATUS_TRANSITION",
  );
}

export function getAllowedOrderTransitions(
  status: OrderStatus,
): readonly OrderStatus[] {
  return allowedTransitions[status];
}