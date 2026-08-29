import { z } from "zod";

export const createOrderSchema = z.object({
  customerId: z.string().min(1),
  cartId: z.string().min(1),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;