import { describe, expect, it } from "vitest";

import {
  assertValidPaymentTransition,
  getValidPaymentTransitions,
  isValidPaymentTransition,
  type PaymentStatus,
} from "./payment-state-machine.js";

describe("Payment State Machine", () => {
  describe("valid transitions", () => {
    it("allows CREATED → PENDING", () => {
      expect(
        isValidPaymentTransition(
          "CREATED",
          "PENDING",
        ),
      ).toBe(true);

      expect(() =>
        assertValidPaymentTransition(
          "CREATED",
          "PENDING",
        ),
      ).not.toThrow();
    });

    it("allows PENDING → AUTHORIZED", () => {
      expect(
        isValidPaymentTransition(
          "PENDING",
          "AUTHORIZED",
        ),
      ).toBe(true);

      expect(() =>
        assertValidPaymentTransition(
          "PENDING",
          "AUTHORIZED",
        ),
      ).not.toThrow();
    });

    it("allows AUTHORIZED → CAPTURED", () => {
      expect(
        isValidPaymentTransition(
          "AUTHORIZED",
          "CAPTURED",
        ),
      ).toBe(true);

      expect(() =>
        assertValidPaymentTransition(
          "AUTHORIZED",
          "CAPTURED",
        ),
      ).not.toThrow();
    });

    it("allows PENDING → FAILED", () => {
      expect(
        isValidPaymentTransition(
          "PENDING",
          "FAILED",
        ),
      ).toBe(true);

      expect(() =>
        assertValidPaymentTransition(
          "PENDING",
          "FAILED",
        ),
      ).not.toThrow();
    });

    it("allows AUTHORIZED → FAILED", () => {
      expect(
        isValidPaymentTransition(
          "AUTHORIZED",
          "FAILED",
        ),
      ).toBe(true);

      expect(() =>
        assertValidPaymentTransition(
          "AUTHORIZED",
          "FAILED",
        ),
      ).not.toThrow();
    });

    it("allows CAPTURED → REFUND_PENDING", () => {
      expect(
        isValidPaymentTransition(
          "CAPTURED",
          "REFUND_PENDING",
        ),
      ).toBe(true);

      expect(() =>
        assertValidPaymentTransition(
          "CAPTURED",
          "REFUND_PENDING",
        ),
      ).not.toThrow();
    });

    it("allows REFUND_PENDING → REFUNDED", () => {
      expect(
        isValidPaymentTransition(
          "REFUND_PENDING",
          "REFUNDED",
        ),
      ).toBe(true);

      expect(() =>
        assertValidPaymentTransition(
          "REFUND_PENDING",
          "REFUNDED",
        ),
      ).not.toThrow();
    });
  });

  describe("invalid transitions", () => {
    const invalidTransitions: Array<
      [PaymentStatus, PaymentStatus]
    > = [
      ["CREATED", "AUTHORIZED"],
      ["CREATED", "CAPTURED"],
      ["CREATED", "FAILED"],
      ["CREATED", "REFUND_PENDING"],
      ["CREATED", "REFUNDED"],

      ["PENDING", "CAPTURED"],
      ["PENDING", "REFUND_PENDING"],
      ["PENDING", "REFUNDED"],

      ["AUTHORIZED", "REFUNDED"],
      ["AUTHORIZED", "REFUND_PENDING"],

      ["CAPTURED", "FAILED"],
      ["CAPTURED", "REFUNDED"],
      ["CAPTURED", "PENDING"],
      ["CAPTURED", "AUTHORIZED"],

      ["FAILED", "PENDING"],
      ["FAILED", "AUTHORIZED"],
      ["FAILED", "CAPTURED"],
      ["FAILED", "REFUND_PENDING"],
      ["FAILED", "REFUNDED"],

      ["REFUND_PENDING", "CAPTURED"],
      ["REFUND_PENDING", "PENDING"],
      ["REFUND_PENDING", "FAILED"],
      ["REFUND_PENDING", "AUTHORIZED"],

      ["REFUNDED", "CAPTURED"],
      ["REFUNDED", "REFUND_PENDING"],
      ["REFUNDED", "PENDING"],
      ["REFUNDED", "FAILED"],
      ["REFUNDED", "AUTHORIZED"],
    ];

    it.each(invalidTransitions)(
      "rejects %s → %s",
      (currentStatus, nextStatus) => {
        expect(
          isValidPaymentTransition(
            currentStatus,
            nextStatus,
          ),
        ).toBe(false);

        expect(() =>
          assertValidPaymentTransition(
            currentStatus,
            nextStatus,
          ),
        ).toThrow();
      },
    );
  });

  describe("terminal states", () => {
    it("does not allow transitions out of FAILED", () => {
      const nextStatuses: PaymentStatus[] = [
        "CREATED",
        "PENDING",
        "AUTHORIZED",
        "CAPTURED",
        "REFUND_PENDING",
        "REFUNDED",
        "UNKNOWN",
      ];

      for (const nextStatus of nextStatuses) {
        expect(
          isValidPaymentTransition(
            "FAILED",
            nextStatus,
          ),
        ).toBe(false);

        expect(() =>
          assertValidPaymentTransition(
            "FAILED",
            nextStatus,
          ),
        ).toThrow();
      }
    });

    it("does not allow transitions out of REFUNDED", () => {
      const nextStatuses: PaymentStatus[] = [
        "CREATED",
        "PENDING",
        "AUTHORIZED",
        "CAPTURED",
        "FAILED",
        "REFUND_PENDING",
        "UNKNOWN",
      ];

      for (const nextStatus of nextStatuses) {
        expect(
          isValidPaymentTransition(
            "REFUNDED",
            nextStatus,
          ),
        ).toBe(false);

        expect(() =>
          assertValidPaymentTransition(
            "REFUNDED",
            nextStatus,
          ),
        ).toThrow();
      }
    });

    it("does not allow transitions out of UNKNOWN", () => {
      const nextStatuses: PaymentStatus[] = [
        "CREATED",
        "PENDING",
        "AUTHORIZED",
        "CAPTURED",
        "FAILED",
        "REFUND_PENDING",
        "REFUNDED",
      ];

      for (const nextStatus of nextStatuses) {
        expect(
          isValidPaymentTransition(
            "UNKNOWN",
            nextStatus,
          ),
        ).toBe(false);

        expect(() =>
          assertValidPaymentTransition(
            "UNKNOWN",
            nextStatus,
          ),
        ).toThrow();
      }
    });
  });

  describe("same-state transitions", () => {
    const statuses: PaymentStatus[] = [
      "CREATED",
      "PENDING",
      "AUTHORIZED",
      "CAPTURED",
      "FAILED",
      "REFUND_PENDING",
      "REFUNDED",
      "UNKNOWN",
    ];

    it.each(statuses)(
      "rejects same-state transition for %s",
      (status) => {
        expect(
          isValidPaymentTransition(
            status,
            status,
          ),
        ).toBe(false);

        expect(() =>
          assertValidPaymentTransition(
            status,
            status,
          ),
        ).toThrow();
      },
    );
  });

  describe("UNKNOWN state", () => {
    it("does not allow UNKNOWN → CREATED", () => {
      expect(
        isValidPaymentTransition(
          "UNKNOWN",
          "CREATED",
        ),
      ).toBe(false);
      expect(() =>
        assertValidPaymentTransition(
          "UNKNOWN",
          "CREATED",
        ),
      ).toThrow();
    });

    it("does not allow UNKNOWN → PENDING", () => {
      expect(
        isValidPaymentTransition(
          "UNKNOWN",
          "PENDING",
        ),
      ).toBe(false);
      expect(() =>
        assertValidPaymentTransition(
          "UNKNOWN",
          "PENDING",
        ),
      ).toThrow();
    });

    it("does not allow UNKNOWN → CAPTURED", () => {
      expect(
        isValidPaymentTransition(
          "UNKNOWN",
          "CAPTURED",
        ),
      ).toBe(false);
      expect(() =>
        assertValidPaymentTransition(
          "UNKNOWN",
          "CAPTURED",
        ),
      ).toThrow();
    });
  });

  describe("structured transition errors", () => {
    it("returns INVALID_PAYMENT_STATUS_TRANSITION", () => {
      expect(() =>
        assertValidPaymentTransition(
          "CREATED",
          "CAPTURED",
        ),
      ).toThrowError(
        expect.objectContaining({
          statusCode: 409,
          code: "INVALID_PAYMENT_STATUS_TRANSITION",
        }),
      );
    });

    it("includes the current and next status in the error message", () => {
      expect(() =>
        assertValidPaymentTransition(
          "CAPTURED",
          "FAILED",
        ),
      ).toThrow(
        "Cannot transition payment from CAPTURED to FAILED.",
      );
    });

    it("rejects same-state transitions with the structured error", () => {
      expect(() =>
        assertValidPaymentTransition(
          "PENDING",
          "PENDING",
        ),
      ).toThrowError(
        expect.objectContaining({
          statusCode: 409,
          code: "INVALID_PAYMENT_STATUS_TRANSITION",
        }),
      );
    });
  });

  describe("allowed transition map", () => {
    it("allows CREATED to move only to PENDING", () => {
      expect(
        getValidPaymentTransitions("CREATED"),
      ).toEqual(["PENDING"]);
    });

    it("allows PENDING to move to AUTHORIZED or FAILED", () => {
      expect(
        getValidPaymentTransitions("PENDING"),
      ).toEqual([
        "AUTHORIZED",
        "FAILED",
      ]);
    });

    it("allows AUTHORIZED to move to CAPTURED or FAILED", () => {
      expect(
        getValidPaymentTransitions("AUTHORIZED"),
      ).toEqual([
        "CAPTURED",
        "FAILED",
      ]);
    });

    it("allows CAPTURED to move only to REFUND_PENDING", () => {
      expect(
        getValidPaymentTransitions("CAPTURED"),
      ).toEqual([
        "REFUND_PENDING",
      ]);
    });

    it("allows REFUND_PENDING to move only to REFUNDED", () => {
      expect(
        getValidPaymentTransitions(
          "REFUND_PENDING",
        ),
      ).toEqual(["REFUNDED"]);
    });

    it("has no outgoing transitions from FAILED", () => {
      expect(
        getValidPaymentTransitions("FAILED"),
      ).toEqual([]);
    });

    it("has no outgoing transitions from REFUNDED", () => {
      expect(
        getValidPaymentTransitions("REFUNDED"),
      ).toEqual([]);
    });

    it("has no outgoing transitions from UNKNOWN", () => {
      expect(
        getValidPaymentTransitions("UNKNOWN"),
      ).toEqual([]);
    });
  });
});