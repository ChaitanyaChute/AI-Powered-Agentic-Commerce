import { AppError } from "../../middleware/error-handler.js";

export const PAYMENT_STATUSES = [
  "CREATED",
  "PENDING",
  "AUTHORIZED",
  "CAPTURED",
  "FAILED",
  "REFUND_PENDING",
  "REFUNDED",
  "UNKNOWN",
] as const;

export type PaymentStatus =
  (typeof PAYMENT_STATUSES)[number];

const VALID_PAYMENT_TRANSITIONS: Record<
  PaymentStatus,
  readonly PaymentStatus[]
> = {
  CREATED: ["PENDING"],

  PENDING: [
    "AUTHORIZED",
    "FAILED",
  ],

  AUTHORIZED: [
    "CAPTURED",
    "FAILED",
  ],

  CAPTURED: [
    "REFUND_PENDING",
  ],

  FAILED: [],

  REFUND_PENDING: [
    "REFUNDED",
  ],

  REFUNDED: [],

  UNKNOWN: [],
};

export function isValidPaymentTransition(
  currentStatus: PaymentStatus,
  nextStatus: PaymentStatus,
): boolean {
  return VALID_PAYMENT_TRANSITIONS[
    currentStatus
  ].includes(nextStatus);
}

export function assertValidPaymentTransition(
  currentStatus: PaymentStatus,
  nextStatus: PaymentStatus,
): void {
  if (
    !isValidPaymentTransition(
      currentStatus,
      nextStatus,
    )
  ) {
    throw new AppError(
      `Cannot transition payment from ${currentStatus} to ${nextStatus}.`,
      409,
      "INVALID_PAYMENT_STATUS_TRANSITION",
    );
  }
}

export function getValidPaymentTransitions(
  status: PaymentStatus,
): readonly PaymentStatus[] {
  return VALID_PAYMENT_TRANSITIONS[status];
}