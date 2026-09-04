import { z } from "zod";

export const createPaymentSchema = z.object({
  orderId: z.string().trim().min(1),
});

export type CreatePaymentInput = z.infer<
  typeof createPaymentSchema
>;

export const verifyPaymentSchema = z.object({
  razorpayPaymentId: z.string().trim().min(1),
  razorpayOrderId: z.string().trim().min(1),
  razorpaySignature: z.string().trim().min(1),
});

export type VerifyPaymentInput = z.infer<
  typeof verifyPaymentSchema
>;
