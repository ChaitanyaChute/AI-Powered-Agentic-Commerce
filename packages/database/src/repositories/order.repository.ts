import type { Order, Prisma } from "@prisma/client";
import { prisma } from "../client.js";

export class OrderRepository {
  constructor(
    private readonly db:
      | typeof prisma
      | Prisma.TransactionClient = prisma,
  ){}

  async findById(id: string) {
    return this.db.order.findUnique({
      where: { id },
    });
  }

  async findByOrderNumber(orderNumber: string) {
    return this.db.order.findUnique({
      where:{orderNumber },
    });
  }

  async findByIdWithItems(id: string) {
    return this.db.order.findUnique({
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

  async create(data: Prisma.OrderCreateInput) {
    return this.db.order.create({
      data,
    });
  }

  async update(
    id: string,
    data: Prisma.OrderUpdateInput,
  ) {
    return this.db.order.update({
      where: { id },
      data,
    });
  }

  async listByCustomerId(customerId: string) {
    return this.db.order.findMany({
      where: {
        customerId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }
}