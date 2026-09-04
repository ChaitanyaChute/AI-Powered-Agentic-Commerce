import * as crypto from "node:crypto";

export function verifyRazorpayPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string,
  keySecret: string,
): boolean {
  const payload = `${orderId}|${paymentId}`;

  const expectedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(payload)
    .digest("hex");

  return safeCompare(
    expectedSignature,
    signature,
  );
}

export function verifyRazorpaySignature(
  payload: string,
  signature: string,
  webhookSecret: string,
): boolean {
  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(payload)
    .digest("hex");

  return safeCompare(
    expectedSignature,
    signature,
  );
}

function safeCompare(
  expected: string,
  received: string,
): boolean {
  const expectedBuffer =
    Buffer.from(expected, "utf8");

  const receivedBuffer =
    Buffer.from(received, "utf8");

  if (
    expectedBuffer.length !==
    receivedBuffer.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    expectedBuffer,
    receivedBuffer,
  );
}