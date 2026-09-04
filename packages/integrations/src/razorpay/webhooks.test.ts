import * as crypto from "node:crypto";

import { describe, expect, it } from "vitest";

import { RazorpayWebhooks } from "./webhooks.js";

describe("RazorpayWebhooks", () => {
  const webhookSecret = "webhook_test_secret";

  const payload = JSON.stringify({
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: "pay_123",
        },
      },
    },
  });

  function createSignature(
    body: string,
    secret: string,
  ): string {
    return crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");
  }

  it("accepts a valid webhook signature", () => {
    const webhooks =
      new RazorpayWebhooks(webhookSecret);

    const signature = createSignature(
      payload,
      webhookSecret,
    );

    expect(
      webhooks.verifySignature({
        payload,
        signature,
      }),
    ).toBe(true);
  });

  it("rejects an invalid webhook signature", () => {
    const webhooks =
      new RazorpayWebhooks(webhookSecret);

    expect(
      webhooks.verifySignature({
        payload,
        signature: "invalid-signature",
      }),
    ).toBe(false);
  });

  it("rejects a signature generated with the wrong secret", () => {
    const webhooks =
      new RazorpayWebhooks(webhookSecret);

    const signature = createSignature(
      payload,
      "wrong-secret",
    );

    expect(
      webhooks.verifySignature({
        payload,
        signature,
      }),
    ).toBe(false);
  });

  it("rejects a valid signature for a different payload", () => {
    const webhooks =
      new RazorpayWebhooks(webhookSecret);

    const signature = createSignature(
      payload,
      webhookSecret,
    );

    expect(
      webhooks.verifySignature({
        payload: `${payload} `,
        signature,
      }),
    ).toBe(false);
  });
});