import {
  verifyRazorpaySignature,
} from "./signatures.js";

import type {
  RazorpayWebhookVerificationInput,
} from "./types.js";

export class RazorpayWebhooks {
  constructor(
    private readonly webhookSecret: string,
  ) {}

  verifySignature(
    input: RazorpayWebhookVerificationInput,
  ): boolean {
    return verifyRazorpaySignature(
      input.payload,
      input.signature,
      this.webhookSecret,
    );
  }
}