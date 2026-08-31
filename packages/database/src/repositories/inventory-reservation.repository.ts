import type {InventoryReservation,Prisma} from "@prisma/client";
import { prisma } from "../client.js";

export class  InventoryReservationRepository {
  constructor(
    private readonly db:
      | typeof prisma
      | Prisma.TransactionClient = prisma,
  ) {}

  async create(
    data: Prisma.InventoryReservationUncheckedCreateInput,
  ): Promise<InventoryReservation> {
    return this.db.inventoryReservation.create({
      data,
    });
  }

  async createMany(
    data: Prisma.InventoryReservationCreateManyInput[],
  ) {
    return this.db.inventoryReservation.createMany({
      data,
    });
  }

  async findById(
    id: string,
  ): Promise<InventoryReservation | null> {
    return this.db.inventoryReservation.findUnique({
      where: {
        id,
      },
    });
  }

  async listByOrderId(
    orderId: string,
  ): Promise<InventoryReservation[]> {
    return this.db.inventoryReservation.findMany({
      where: {
        orderId,
      },
      orderBy: {
        createdAt: "asc",
      },
    });
  }

  async listActiveByOrderId(
    orderId: string,
  ): Promise<InventoryReservation[]> {
    return this.db.inventoryReservation.findMany({
      where: {
        orderId,
        status: "ACTIVE",
      },
      orderBy: {
        createdAt: "asc",
      },
    });
  }

  async markReleased(
    id: string,
  ): Promise<InventoryReservation> {
    return this.db.inventoryReservation.update({
      where: {
        id,
      },
      data: {
        status: "RELEASED",
        releasedAt: new Date(),
      },
    });
  }
}