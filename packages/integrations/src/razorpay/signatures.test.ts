import { describe, expect, it } from "vitest";
import {
  verifyRazorpayPaymentSignature,
  verifyRazorpaySignature,
} from "./signatures.js";
import * as crypto from "node:crypto";

describe("Razorpay signatures", () => {
  const keySecret = "test-key-secret";
  const webhookSecret = "test-webhook-secret";

  describe("payment signature", () => {
    it("accepts a valid payment signature", () => {
      const orderId = "order_123";
      const paymentId = "pay_123";

      const signature = crypto
        .createHmac("sha256", keySecret)
        .update(`${orderId}|${paymentId}`)
        .digest("hex");

      expect(
        verifyRazorpayPaymentSignature(
          orderId,
          paymentId,
          signature,
          keySecret,
        ),
      ).toBe(true);
    });

    it("rejects an invalid payment signature", () => {
      expect(
        verifyRazorpayPaymentSignature(
          "order_123",
          "pay_123",
          "invalid-signature",
          keySecret,
        ),
      ).toBe(false);
    });

    it("rejects a signature generated with the wrong secret", () => {

      const signature = crypto
        .createHmac("sha256", "wrong-secret")
        .update("order_123|pay_123")
        .digest("hex");

      expect(
        verifyRazorpayPaymentSignature(
          "order_123",
          "pay_123",
          signature,
          keySecret,
        ),
      ).toBe(false);
    });

    it("rejects a signature for different payment data", () => {


      const signature = crypto
        .createHmac("sha256", keySecret)
        .update("order_123|pay_999")
        .digest("hex");

      expect(
        verifyRazorpayPaymentSignature(
          "order_123",
          "pay_123",
          signature,
          keySecret,
        ),
      ).toBe(false);
    });
  });

  describe("webhook signature", () => {
    it("accepts a valid webhook signature", () => {
      const payload = '{"event":"payment.captured"}';


      const signature = crypto
        .createHmac("sha256", webhookSecret)
        .update(payload)
        .digest("hex");

      expect(
        verifyRazorpaySignature(
          payload,
          signature,
          webhookSecret,
        ),
      ).toBe(true);
    });

    it("rejects an invalid webhook signature", () => {
      expect(
        verifyRazorpaySignature(
          '{"event":"payment.captured"}',
          "invalid-signature",
          webhookSecret,
        ),
      ).toBe(false);
    });

    it("rejects a webhook signature generated with the wrong secret", () => {
      
      const payload = '{"event":"payment.captured"}';

      const signature = crypto
        .createHmac("sha256", "wrong-secret")
        .update(payload)
        .digest("hex");

      expect(
        verifyRazorpaySignature(
          payload,
          signature,
          webhookSecret,
        ),
      ).toBe(false);
    });
  });
});