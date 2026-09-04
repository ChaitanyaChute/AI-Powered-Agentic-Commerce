import { AppError } from "../../middleware/error-handler.js";

export const PaymentErrorCode = {
  NOT_FOUND: "PAYMENT_NOT_FOUND",
  ALREADY_EXISTS: "PAYMENT_ALREADY_EXISTS",
  ALREADY_CAPTURED: "PAYMENT_ALREADY_CAPTURED",
  INVALID_STATE: "PAYMENT_INVALID_STATE",
  AMOUNT_MISMATCH: "PAYMENT_AMOUNT_MISMATCH",
  CURRENCY_MISMATCH: "PAYMENT_CURRENCY_MISMATCH",
  CREATION_FAILED: "PAYMENT_CREATION_FAILED",
  VERIFICATION_FAILED: "PAYMENT_VERIFICATION_FAILED",
  CAPTURE_FAILED: "PAYMENT_CAPTURE_FAILED",
  PROVIDER_TIMEOUT: "PAYMENT_PROVIDER_TIMEOUT",
  PROVIDER_UNAVAILABLE: "PAYMENT_PROVIDER_UNAVAILABLE",
  PROVIDER_ERROR: "PAYMENT_PROVIDER_ERROR",
  IDEMPOTENCY_CONFLICT: "PAYMENT_IDEMPOTENCY_CONFLICT",
} as const;

export type PaymentErrorCode =
  (typeof PaymentErrorCode)[keyof typeof PaymentErrorCode];

const RETRYABLE_PAYMENT_ERRORS = new Set<PaymentErrorCode>([
  PaymentErrorCode.CREATION_FAILED,
  PaymentErrorCode.CAPTURE_FAILED,
  PaymentErrorCode.PROVIDER_TIMEOUT,
  PaymentErrorCode.PROVIDER_UNAVAILABLE,
  PaymentErrorCode.PROVIDER_ERROR,
]);

export function isRetryablePaymentError(
  code: PaymentErrorCode,
): boolean {
  return RETRYABLE_PAYMENT_ERRORS.has(code);
}

export class PaymentError extends AppError {
  public readonly paymentCode: PaymentErrorCode;
  public readonly retryable: boolean;

  constructor(
    code: PaymentErrorCode,
    message: string,
    statusCode: number,
    details?: unknown,
  ) {
    super(message, statusCode, code, details);

    this.name = "PaymentError";
    this.paymentCode = code;
    this.retryable = isRetryablePaymentError(code);
  }
}