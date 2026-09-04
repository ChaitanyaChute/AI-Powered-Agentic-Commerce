import Razorpay from "razorpay";
import type { RazorpayProviderConfig } from "./types.js";

export class RazorpayClient {
  public readonly client: Razorpay;

  public readonly keyId: string;

  public readonly keySecret: string;

  constructor(config: RazorpayProviderConfig) {
    this.keyId = config.keyId;
    this.keySecret = config.keySecret;

    this.client = new Razorpay({
      key_id: config.keyId,
      key_secret: config.keySecret,
    });
  }
}