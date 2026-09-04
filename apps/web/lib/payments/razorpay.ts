import {
  createPayment,
  verifyPayment,
  type CheckoutData,
  type RazorpayCheckoutResponse,
  type VerifiedPayment,
} from "./payment-api";

const RAZORPAY_CHECKOUT_URL =
  "https://checkout.razorpay.com/v1/checkout.js";

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description: string;
  handler: (
    response: RazorpayCheckoutResponse,
  ) => void;
  modal?: {
    ondismiss?: () => void;
  };
  theme?: {
    color?: string;
  };
}

interface RazorpayInstance {
  open(): void;
}

declare global {
  interface Window {
    Razorpay?: new (
      options: RazorpayOptions,
    ) => RazorpayInstance;
  }
}

let checkoutScriptPromise:
  | Promise<void>
  | undefined;

export function loadRazorpayCheckout() {
  if (typeof window === "undefined") {
    return Promise.reject(
      new Error(
        "Razorpay Checkout can only run in the browser.",
      ),
    );
  }

  if (window.Razorpay) {
    return Promise.resolve();
  }

  checkoutScriptPromise ??= new Promise(
    (resolve, reject) => {
      const existingScript =
        document.querySelector<HTMLScriptElement>(
          `script[src="${RAZORPAY_CHECKOUT_URL}"]`,
        );

      if (existingScript) {
        existingScript.addEventListener(
          "load",
          () => resolve(),
          { once: true },
        );
        existingScript.addEventListener(
          "error",
          () =>
            reject(
              new Error(
                "Unable to load Razorpay Checkout.",
              ),
            ),
          { once: true },
        );
        return;
      }

      const script =
        document.createElement("script");
      script.src = RAZORPAY_CHECKOUT_URL;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () =>
        reject(
          new Error(
            "Unable to load Razorpay Checkout.",
          ),
        );

      document.body.appendChild(script);
    },
  );

  return checkoutScriptPromise;
}

export async function openRazorpayCheckout(
  checkout: CheckoutData,
) {
  await loadRazorpayCheckout();

  return new Promise<RazorpayCheckoutResponse>(
    (resolve, reject) => {
      if (!window.Razorpay) {
        reject(
          new Error(
            "Razorpay Checkout is unavailable.",
          ),
        );
        return;
      }

      const razorpay = new window.Razorpay({
        key: checkout.keyId,
        amount: checkout.amount,
        currency: checkout.currency,
        order_id: checkout.razorpayOrderId,
        name: "AI Commerce Agent",
        description: "Complete your order",
        handler: resolve,
        modal: {
          ondismiss: () =>
            reject(
              new Error(
                "Payment checkout was closed.",
              ),
            ),
        },
        theme: {
          color: "#0f766e",
        },
      });

      razorpay.open();
    },
  );
}

export async function startPayment(
  orderId: string,
  customerId: string,
): Promise<VerifiedPayment> {
  const checkout = await createPayment({
    orderId,
  });

  if (!checkout.keyId) {
    throw new Error(
      "Razorpay key ID is missing from checkout data.",
    );
  }

  const checkoutResponse =
    await openRazorpayCheckout(checkout);

  const verification = await verifyPayment({
    paymentId: checkout.paymentId,
    customerId,
    checkoutResponse,
  });

  if (!verification.verified) {
    throw new Error(
      "Payment could not be verified.",
    );
  }

  return verification;
}
