import { z } from "zod";

export const razorpayPaymentEntitySchema =
  z
    .object({
      id: z.string().trim().min(1),
      order_id: z.string().trim().min(1),
      amount: z.number().int().nonnegative(),
      currency: z.string().trim().min(1),
      status: z.string().trim().min(1),
      error_code: z.string().nullish(),
      error_description: z.string().nullish(),
    })
    .passthrough();

export const razorpayOrderEntitySchema =
  z
    .object({
      id: z.string().trim().min(1),
      status: z.string().trim().min(1).optional(),
      amount_paid: z
        .number()
        .int()
        .nonnegative()
        .optional(),
      currency: z.string().trim().min(1).optional(),
    })
    .passthrough();

export const razorpayWebhookSchema = z
  .object({
    event: z.enum([
      "payment.authorized",
      "payment.captured",
      "payment.failed",
      "order.paid",
    ]),
    payload: z
      .object({
        payment: z
          .object({
            entity:
              razorpayPaymentEntitySchema,
          })
          .optional(),
        order: z
          .object({
            entity: razorpayOrderEntitySchema,
          })
          .optional(),
      })
      .passthrough(),
  })
  .passthrough();

export type RazorpayWebhookPayload =
  z.infer<typeof razorpayWebhookSchema>;
