import type { Prisma, Product } from "@prisma/client";
import { prisma } from "../client.js";

export class ProductRepository {
  async findById(id: string): Promise<Product | null> {
    return prisma.product.findUnique({
      where: { id },
    });
  }

  async findBySku(sku: string): Promise<Product | null> {
    return prisma.product.findUnique({
      where: { sku },
    });
  }

  async create(data: Prisma.ProductCreateInput): Promise<Product> {
    return prisma.product.create({
      data,
    });
  }

  async update(
    id: string,
    data: Prisma.ProductUpdateInput,
  ): Promise<Product> {
    return prisma.product.update({
      where: { id },
      data,
    });
  }

  async listActive(): Promise<Product[]> {
    return prisma.product.findMany({
      where: {
        active: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }
}