import type { OrderItem, Prisma } from "@prisma/client";
import { prisma } from "../client.js";

export class OrderItemRepository {
  constructor(
  private readonly db:
    | typeof prisma
    | Prisma.TransactionClient = prisma,
) {}

  async findById(id: string): Promise<OrderItem | null> {
    return this.db.orderItem.findUnique({
      where: { id },
    });
  }

  async listByOrderId(orderId: string): Promise<OrderItem[]> {
    return this.db.orderItem.findMany({
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
    return this.db.orderItem.create({
      data,
    });
  }

  async createMany(
    data: Prisma.OrderItemCreateManyInput[],
  ): Promise<{ count: number }> {
    return this.db.orderItem.createMany({
      data,
    });
  }

  async delete(id: string): Promise<OrderItem> {
    return this.db.orderItem.delete({
      where: { id },
    });
  }
}