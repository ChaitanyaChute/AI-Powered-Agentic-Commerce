export interface RazorpayProviderConfig {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
}

export interface RazorpayOrderRequest {
  amount: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface RazorpayOrderResponse {
  id: string;
  entity: string;
  amount: string | number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: string;
  created_at: number;
}

export interface RazorpayPaymentResponse {
  id: string;
  entity: string;
  amount: number;
  currency: string;
  status: string;
  order_id: string;
  method?: string;
  captured?: boolean;
}

export interface RazorpayPaymentVerificationInput {
  orderId: string;
  paymentId: string;
  signature: string;
}

export interface RazorpayWebhookVerificationInput {
  payload: string;
  signature: string;
}