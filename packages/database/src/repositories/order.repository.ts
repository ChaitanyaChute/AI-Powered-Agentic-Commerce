import type { Order, Prisma } from "@prisma/client";
import { prisma } from "../client.js";

export class OrderRepository {
  async findById(id: string): Promise<Order | null> {
    return prisma.order.findUnique({
      where: { id },
    });
  }

  async findByOrderNumber(
    orderNumber: string,
  ): Promise<Order | null> {
    return prisma.order.findUnique({
      where: {
        orderNumber,
      },
    });
  }

  async findByIdWithItems(id: string) {
    return prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });
  }

  async create(
    data: Prisma.OrderCreateInput,
  ): Promise<Order> {
    return prisma.order.create({
      data,
    });
  }

  async update(
    id: string,
    data: Prisma.OrderUpdateInput,
  ): Promise<Order> {
    return prisma.order.update({
      where: { id },
      data,
    });
  }

  async listByCustomerId(
    customerId: string,
  ): Promise<Order[]> {
    return prisma.order.findMany({
      where: {
        customerId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }
}