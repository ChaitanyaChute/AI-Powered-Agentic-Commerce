"use client";

import { useMemo, useState } from "react";

import { CheckoutSummary } from "../../components/checkout/checkout-summary";
import { PaymentButton } from "../../components/checkout/payment-button";
import {
  createOrder,
  type Order,
} from "../../lib/payments/payment-api";

export default function CheckoutPage() {
  const [customerId, setCustomerId] =
    useState("");
  const [cartId, setCartId] = useState("");
  const [order, setOrder] =
    useState<Order | null>(null);
  const [status, setStatus] =
    useState<string | null>(null);
  const [isCreatingOrder, setIsCreatingOrder] =
    useState(false);

  const canCreateOrder = useMemo(
    () =>
      customerId.trim().length > 0 &&
      cartId.trim().length > 0 &&
      !isCreatingOrder,
    [cartId, customerId, isCreatingOrder],
  );

  async function handleCreateOrder(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!canCreateOrder) {
      return;
    }

    setStatus(null);
    setIsCreatingOrder(true);

    try {
      const createdOrder = await createOrder({
        customerId: customerId.trim(),
        cartId: cartId.trim(),
      });

      setOrder(createdOrder);
      setStatus(
        "Order created. Continue to Razorpay Checkout.",
      );
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Unable to create order.",
      );
    } finally {
      setIsCreatingOrder(false);
    }
  }

  return (
    <main className="checkout-page">
      <section className="checkout-panel">
        <form onSubmit={handleCreateOrder}>
          <label>
            Customer ID
            <input
              value={customerId}
              onChange={(event) =>
                setCustomerId(
                  event.target.value,
                )
              }
              autoComplete="off"
            />
          </label>
          <label>
            Cart ID
            <input
              value={cartId}
              onChange={(event) =>
                setCartId(event.target.value)
              }
              autoComplete="off"
            />
          </label>
          <button
            type="submit"
            disabled={!canCreateOrder}
          >
            {isCreatingOrder
              ? "Creating order..."
              : "Create order"}
          </button>
        </form>

        <CheckoutSummary order={order} />

        <PaymentButton
          orderId={order?.id ?? null}
          customerId={customerId.trim()}
          onVerified={() => {
            setOrder((currentOrder) =>
              currentOrder
                ? {
                    ...currentOrder,
                    status: "PAID",
                  }
                : currentOrder,
            );
            setStatus(
              "Payment verified by backend.",
            );
          }}
        />

        {status ? (
          <p className="checkout-status">
            {status}
          </p>
        ) : null}
      </section>

      <style jsx>{`
        .checkout-page {
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 32px;
          background: #f5f7f9;
          color: #17202a;
        }

        .checkout-panel {
          width: min(100%, 720px);
          display: grid;
          gap: 24px;
          padding: 28px;
          border: 1px solid #d9e2e7;
          border-radius: 8px;
          background: #ffffff;
          box-shadow: 0 14px 40px
            rgba(15, 23, 42, 0.08);
        }

        form {
          display: grid;
          gap: 16px;
        }

        label {
          display: grid;
          gap: 8px;
          font-size: 14px;
          font-weight: 600;
        }

        input {
          min-height: 42px;
          border: 1px solid #b9c7d0;
          border-radius: 6px;
          padding: 0 12px;
          font: inherit;
        }

        button {
          min-height: 44px;
          border: 0;
          border-radius: 6px;
          padding: 0 16px;
          background: #0f766e;
          color: white;
          font: inherit;
          font-weight: 700;
          cursor: pointer;
        }

        button:disabled {
          background: #9aa8af;
          cursor: not-allowed;
        }

        .summary {
          display: grid;
          gap: 16px;
          border-top: 1px solid #e4eaee;
          padding-top: 24px;
        }

        h2 {
          margin: 0;
          font-size: 24px;
        }

        p {
          margin: 0;
          color: #52616b;
        }

        dl {
          display: grid;
          gap: 12px;
          margin: 0;
        }

        dl div {
          display: flex;
          justify-content: space-between;
          gap: 16px;
        }

        dt {
          color: #52616b;
        }

        dd {
          margin: 0;
          font-weight: 700;
          text-align: right;
          overflow-wrap: anywhere;
        }

        .payment-action {
          display: grid;
          gap: 10px;
        }

        .payment-action p,
        .checkout-status {
          color: #8a3b12;
        }

        @media (max-width: 520px) {
          .checkout-page {
            padding: 16px;
          }

          .checkout-panel {
            padding: 20px;
          }
        }
      `}</style>
    </main>
  );
}
