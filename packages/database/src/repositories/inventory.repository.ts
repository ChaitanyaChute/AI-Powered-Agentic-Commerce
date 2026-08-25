import type { Inventory,Prisma } from "@prisma/client";
import { prisma } from "../client.js";

export class InventoryRepository {
  constructor(
    private readonly db:
      | typeof prisma
      | Prisma.TransactionClient = prisma,
  ) {}

  async findByProductId(productId: string): Promise<Inventory | null> {
    return this.db.inventory.findUnique({
      where: {
        productId,
      },
    });
  }

  async create(
    productId: string,quantity = 0,
  ):Promise<Inventory> {
    return this.db.inventory.create({
      data:{
        productId,
        quantity,
      },
    });
  }

  async updateQuantity(
    productId: string,quantity: number,
  ):Promise<Inventory> {
    return this.db.inventory.update({
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
    return this.db.inventory.update({
      where:{
        productId,
      },
      data:{
        reserved,
      },
    });
  }
  async reserve(
  inventoryId: string,
  quantity: number,
) {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("Reservation quantity must be positive.");
  }

  const result = await this.db.$executeRaw`
    UPDATE "Inventory"
    SET
      "reserved" = "reserved" + ${quantity},
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE
      "id" = ${inventoryId}
      AND "quantity" - "reserved" >= ${quantity}
  `;

  if (result !== 1) {
    throw new Error("Insufficient inventory.");
  }

  return this.db.inventory.findUniqueOrThrow({
    where: {
      id: inventoryId,
    },
  });
}
}