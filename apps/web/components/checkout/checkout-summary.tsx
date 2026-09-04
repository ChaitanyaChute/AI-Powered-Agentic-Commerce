import type { Order } from "../../lib/payments/payment-api";

function formatMinorAmount(
  amountMinor: number,
  currency: string,
) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
  }).format(amountMinor / 100);
}

export function CheckoutSummary({
  order,
}: {
  order: Order | null;
}) {
  return (
    <section className="summary">
      <h2>Checkout</h2>
      {order ? (
        <dl>
          <div>
            <dt>Order</dt>
            <dd>
              {order.orderNumber ?? order.id}
            </dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{order.status}</dd>
          </div>
          <div>
            <dt>Total</dt>
            <dd>
              {formatMinorAmount(
                order.totalMinor,
                order.currency,
              )}
            </dd>
          </div>
        </dl>
      ) : (
        <p>
          Create an order from a cart, then
          continue to Razorpay Checkout.
        </p>
      )}
    </section>
  );
}
