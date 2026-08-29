import type { Order, Prisma } from "@prisma/client";

import { prisma } from "../client.js";

export class OrderRepository {
  constructor(
    private readonly db:
      | typeof prisma
      | Prisma.TransactionClient = prisma,
  ) {}

  async create(
    data: Prisma.OrderCreateInput,
  ): Promise<Order> {
    return this.db.order.create({
      data,
    });
  }

  async findById(
    id: string,
  ): Promise<Order | null> {
    return this.db.order.findUnique({
      where: {
        id,
      },
    });
  }

  async findByIdWithItems(
    id: string,
  ) {
    return this.db.order.findUnique({
      where: {
        id,
      },
      include: {
        items: true,
      },
    });
  }

  async findByOrderNumber(
    orderNumber: string,
  ) {
    return this.db.order.findUnique({
      where: {
        orderNumber,
      },
      include: {
        items: true,
      },
    });
  }

  async listByCustomerId(
    customerId: string,
  ) {
    return this.db.order.findMany({
      where: {
        customerId,
      },
      include: {
        items: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async update(
    id: string,
    data: Prisma.OrderUpdateInput,
  ): Promise<Order> {
    return this.db.order.update({
      where: {
        id,
      },
      data,
    });
  }
}