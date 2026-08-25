import type { Customer, Prisma } from "@prisma/client"
import { prisma } from "../client.js";

export class CustomerRepository {
  async findById(id: string):Promise<Customer | null> {
    return prisma.customer.findUnique({
      where: {id},
    });
  }

  async findByEmail(email: string):Promise<Customer | null> {
    return prisma.customer.findUnique({
      where: { email},
    });
  }

  async create(data:Prisma.CustomerCreateInput): Promise<Customer> {
    return prisma.customer.create({
      data,
    });
  }

  async update(
    id: string,
    data: Prisma.CustomerUpdateInput,
  ):Promise<Customer> {
    return prisma.customer.update({
      where: {id },
      data,
    });
  }
}