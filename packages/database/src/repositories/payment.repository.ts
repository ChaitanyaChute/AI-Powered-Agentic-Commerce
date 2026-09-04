import type { Prisma } from "@prisma/client";

import { prisma } from "../client.js";

export class PaymentRepository {
  async createPayment(
    data: Prisma.PaymentCreateInput,
  ) {
    return prisma.payment.create({
      data,
    });
  }

  async getPaymentById(id: string) {
    return prisma.payment.findUnique({
      where: { id },
    });
  }

  async getPaymentByOrderId(orderId: string) {
    return prisma.payment.findFirst({
      where: { orderId },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async createAttempt(
    data: Prisma.PaymentAttemptCreateInput,
  ) {
    return prisma.paymentAttempt.create({
      data,
    });
  }

  async updatePaymentStatus(
    id: string,
    status: Prisma.PaymentUpdateInput["status"],
  ) {
    return prisma.payment.update({
      where: { id },
      data: {
        status,
      },
    });
  }

  async updateProviderOrderId(
    id: string,
    providerOrderId: string,
  ) {
    return prisma.payment.update({
      where: { id },
      data: {
        providerOrderId,
        status: "PENDING",
      },
    });
  }

  async markVerified(input: {
    id: string;
    providerPaymentId: string;
    status: Prisma.PaymentUpdateInput["status"];
  }) {
    return prisma.payment.update({
      where: { id: input.id },
      data: {
        providerPaymentId: input.providerPaymentId,
        status: input.status,
      },
    });
  }

  async findByProviderPaymentId(
    providerPaymentId: string,
  ) {
    return prisma.payment.findUnique({
      where: {
        providerPaymentId,
      },
    });
  }

  async deletePayment(id: string) {
    return prisma.payment.delete({
      where: { id },
    });
  }
}
