import type { Cart, Prisma } from "@prisma/client";
import { prisma } from "../client.js";

export class CartRepository {
  async findById(id: string):Promise<Cart | null>{
    return prisma.cart.findUnique({
      where:{id },
    });
  }

  async findActiveByCustomerId(
    customerId:string,
  ):Promise<Cart| null> {
    return prisma.cart.findFirst({
      where:{
        customerId,
        status: "ACTIVE",
      },
      orderBy:{
        createdAt:"desc",
      },
    });
  }

  async create(
    data:Prisma.CartCreateInput,
  ):Promise<Cart> {
    return prisma.cart.create({
      data,
    });
  }

  async update(
    id: string,
    data: Prisma.CartUpdateInput,
  ):Promise<Cart> {
    return prisma.cart.update({
      where:{id},
      data,
    });
  }

  async findByIdWithItems(id: string) {
    return prisma.cart.findUnique({
      where: {id},
      include:{
        items:{
          include:{
            product: true,
          },
        },
      },
    });
  }
}