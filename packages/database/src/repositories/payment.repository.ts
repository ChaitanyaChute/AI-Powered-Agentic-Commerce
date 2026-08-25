import type { Payment, Prisma } from "@prisma/client";
import { prisma } from "../client.js";

export class PaymentRepository {
  async findById(id: string): Promise<Payment | null> {
    return prisma.payment.findUnique({
      where: { id },
    });
  }

  async findByOrderId(orderId: string): Promise<Payment[]> {
    return prisma.payment.findMany({
      where: {
        orderId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async findByProviderPaymentId(
    providerPaymentId: string,
  ): Promise<Payment | null> {
    return prisma.payment.findUnique({
      where: {
        providerPaymentId,
      },
    });
  }

  async create(
    data: Prisma.PaymentCreateInput,
  ): Promise<Payment> {
    return prisma.payment.create({
      data,
    });
  }

  async update(
    id: string,
    data: Prisma.PaymentUpdateInput,
  ): Promise<Payment> {
    return prisma.payment.update({
      where: { id },
      data,
    });
  }
}