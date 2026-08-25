import type { OrderItem, Prisma } from "@prisma/client";
import { prisma } from "../client.js";

export class OrderItemRepository {
  async findById(id: string): Promise<OrderItem | null> {
    return prisma.orderItem.findUnique({
      where: { id },
    });
  }

  async listByOrderId(orderId: string): Promise<OrderItem[]> {
    return prisma.orderItem.findMany({
      where: {
        orderId,
      },
      orderBy: {
        createdAt: "asc",
      },
    });
  }

  async create(
    data: Prisma.OrderItemCreateInput,
  ): Promise<OrderItem> {
    return prisma.orderItem.create({
      data,
    });
  }

  async createMany(
    data: Prisma.OrderItemCreateManyInput[],
  ): Promise<{ count: number }> {
    return prisma.orderItem.createMany({
      data,
    });
  }

  async delete(id: string): Promise<OrderItem> {
    return prisma.orderItem.delete({
      where: { id },
    });
  }
}