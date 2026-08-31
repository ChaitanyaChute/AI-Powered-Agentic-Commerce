export type PaymentProviderName =
  | "RAZORPAY";

export interface CreatePaymentOrderInput {
  paymentId: string;
  orderId: string;
  amountMinor: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface CreatePaymentOrderResult {
  providerOrderId: string;
  amountMinor: number;
  currency: string;
}

export interface GetPaymentInput {
  providerPaymentId: string;
}

export interface GetPaymentResult {
  providerPaymentId: string;
  providerOrderId: string;
  amountMinor: number;
  currency: string;
  status: string;
}

export interface VerifyPaymentInput {
  providerOrderId: string;
  providerPaymentId: string;
  signature: string;
}

export interface VerifyPaymentResult {
  verified: boolean;
  providerPaymentId: string;
  providerOrderId: string;
}

export interface CapturePaymentInput {
  providerPaymentId: string;
  amountMinor: number;
  currency: string;
}

export interface CapturePaymentResult {
  providerPaymentId: string;
  providerOrderId: string;
  amountMinor: number;
  currency: string;
  status: string;
}

export interface RefundPaymentInput {
  providerPaymentId: string;
  amountMinor?: number;
  notes?: Record<string, string>;
}

export interface RefundPaymentResult {
  providerPaymentId: string;
  refundId: string;
  amountMinor: number;
  currency: string;
  status: string;
}

export interface PaymentProvider {
  readonly name: PaymentProviderName;

  createOrder(
    input: CreatePaymentOrderInput,
  ): Promise<CreatePaymentOrderResult>;

  getPayment(
    input: GetPaymentInput,
  ): Promise<GetPaymentResult>;

  verifyPayment(
    input: VerifyPaymentInput,
  ): Promise<VerifyPaymentResult>;

  capturePayment(
    input: CapturePaymentInput,
  ): Promise<CapturePaymentResult>;

  refundPayment(
    input: RefundPaymentInput,
  ): Promise<RefundPaymentResult>;
}