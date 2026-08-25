import type { Cart, Prisma } from "@prisma/client";
import { prisma } from "../client.js";

export class CartRepository {
  constructor(
  private readonly db:
    | typeof prisma
    | Prisma.TransactionClient = prisma,
) {}

  async findById(id: string):Promise<Cart | null>{
    return this.db.cart.findUnique({
      where:{id },
    });
  }

  async findActiveByCustomerId(
    customerId:string,
  ):Promise<Cart| null> {
    return this.db.cart.findFirst({
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
    return this.db.cart.create({
      data,
    });
  }

  async update(
    id: string,
    data: Prisma.CartUpdateInput,
  ):Promise<Cart> {
    return this.db.cart.update({
      where:{id},
      data,
    });
  }

  async findByIdWithItems(id: string) {
    return this.db.cart.findUnique({
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