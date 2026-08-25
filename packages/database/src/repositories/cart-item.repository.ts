import type { CartItem, Prisma } from "@prisma/client";
import { prisma } from "../client.js";

export class CartItemRepository {
  async findById(id: string):Promise<CartItem | null> {
    return prisma.cartItem.findUnique({
      where: {id },
    });
  }

  async findByCartAndProduct(
    cartId: string,
    productId: string,
  ):Promise<CartItem | null> {
    return prisma.cartItem.findUnique({
      where: {
        cartId_productId: {
          cartId,
          productId,
        },
      },
    });
  }

  async listByCartId(cartId: string): Promise<CartItem[]> {
    return prisma.cartItem.findMany({
      where: {
        cartId,
      },
      orderBy: {
        createdAt: "asc",
      },
    });
  }

  async create(
    data: Prisma.CartItemCreateInput,
  ):Promise<CartItem> {
    return prisma.cartItem.create({
      data,
    });
  }

  async update(
    id: string,
    data: Prisma.CartItemUpdateInput,
  ): Promise<CartItem> {
    return prisma.cartItem.update({
      where: {id },
      data,
    });
  }

  async delete(id: string): Promise<CartItem> {
    return prisma.cartItem.delete({
      where: {id },
    });
  }
}