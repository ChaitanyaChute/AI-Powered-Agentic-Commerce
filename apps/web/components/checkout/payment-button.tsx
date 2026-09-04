"use client";

import { useState } from "react";

import { startPayment } from "../../lib/payments/razorpay";

export function PaymentButton({
  orderId,
  customerId,
  onVerified,
}: {
  orderId: string | null;
  customerId: string;
  onVerified: () => void;
}) {
  const [isPaying, setIsPaying] =
    useState(false);
  const [error, setError] =
    useState<string | null>(null);

  async function handlePay() {
    if (!orderId || !customerId) {
      return;
    }

    setError(null);
    setIsPaying(true);

    try {
      await startPayment(
        orderId,
        customerId,
      );
      onVerified();
    } catch (paymentError) {
      setError(
        paymentError instanceof Error
          ? paymentError.message
          : "Payment failed.",
      );
    } finally {
      setIsPaying(false);
    }
  }

  return (
    <div className="payment-action">
      <button
        type="button"
        onClick={handlePay}
        disabled={
          !orderId || !customerId || isPaying
        }
      >
        {isPaying
          ? "Opening Razorpay..."
          : "Pay with Razorpay"}
      </button>
      {error ? (
        <p role="alert">{error}</p>
      ) : null}
    </div>
  );
}
