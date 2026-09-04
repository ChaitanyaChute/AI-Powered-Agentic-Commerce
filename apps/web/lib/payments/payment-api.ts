const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:4000";

export interface Order {
  id: string;
  orderNumber?: string;
  totalMinor: number;
  currency: string;
  status: string;
}

export interface CheckoutData {
  paymentId: string;
  razorpayOrderId: string;
  amount: number;
  currency: string;
  keyId: string;
}

export interface RazorpayCheckoutResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface VerifiedPayment {
  verified: boolean;
  payment: {
    id: string;
    orderId: string;
    status: string;
    providerPaymentId: string | null;
  };
}

interface ApiResponse<T> {
  data: T;
}

function createIdempotencyKey(prefix: string) {
  const randomId =
    globalThis.crypto?.randomUUID?.() ??
    Math.random().toString(36).slice(2);

  return `${prefix}-${randomId}`;
}

async function postJson<T>(
  path: string,
  body: unknown,
  idempotencyKey?: string,
  headers?: Record<string, string>,
): Promise<T> {
  const response = await fetch(
    `${API_BASE_URL}${path}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
        ...(idempotencyKey
          ? {
              "Idempotency-Key": idempotencyKey,
            }
          : {}),
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      message ||
        `Request failed with status ${response.status}`,
    );
  }

  const payload =
    (await response.json()) as ApiResponse<T>;

  return payload.data;
}

export async function createOrder(input: {
  customerId: string;
  cartId: string;
}) {
  return postJson<Order>(
    "/api/orders",
    input,
    createIdempotencyKey("order"),
  );
}

export async function createPayment(input: {
  orderId: string;
}) {
  const result = await postJson<{
    checkout?: CheckoutData;
    payment?: {
      id: string;
      amountMinor: number;
      currency: string;
    };
    providerOrder?: {
      providerOrderId: string;
      amountMinor: number;
      currency: string;
    };
  }>(
    "/api/payments",
    input,
    createIdempotencyKey("payment"),
  );

  if (result.checkout) {
    return result.checkout;
  }

  if (
    result.payment &&
    result.providerOrder
  ) {
    return {
      paymentId: result.payment.id,
      razorpayOrderId:
        result.providerOrder.providerOrderId,
      amount: result.providerOrder.amountMinor,
      currency: result.providerOrder.currency,
      keyId: "",
    };
  }

  throw new Error(
    "Payment API did not return checkout data.",
  );
}

export async function verifyPayment(input: {
  paymentId: string;
  customerId: string;
  checkoutResponse: RazorpayCheckoutResponse;
}) {
  return postJson<VerifiedPayment>(
    `/api/payments/${input.paymentId}/verify`,
    {
      razorpayPaymentId:
        input.checkoutResponse
          .razorpay_payment_id,
      razorpayOrderId:
        input.checkoutResponse
          .razorpay_order_id,
      razorpaySignature:
        input.checkoutResponse
          .razorpay_signature,
    },
    undefined,
    {
      "x-customer-id": input.customerId,
    },
  );
}
