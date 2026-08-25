import type { Inventory } from "@prisma/client";
import { prisma } from "../client.js";

export class InventoryRepository {
  async findByProductId(productId: string): Promise<Inventory | null> {
    return prisma.inventory.findUnique({
      where: {
        productId,
      },
    });
  }

  async create(
    productId: string,quantity = 0,
  ):Promise<Inventory> {
    return prisma.inventory.create({
      data:{
        productId,
        quantity,
      },
    });
  }

  async updateQuantity(
    productId: string,quantity: number,
  ):Promise<Inventory> {
    return prisma.inventory.update({
      where:{
        productId,
      },
      data:{
        quantity,
      },
    });
  }

  async updateReserved(
    productId:string,
    reserved:number,
  ):Promise<Inventory> {
    return prisma.inventory.update({
      where:{
        productId,
      },
      data:{
        reserved,
      },
    });
  }
}