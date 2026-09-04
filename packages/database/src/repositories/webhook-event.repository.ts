import type { Prisma } from "@prisma/client";

import { prisma } from "../client.js";

function isUniqueConstraintError(error: unknown): error is { code: "P2002" } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

export class WebhookEventRepository {
  async createReceived(data: {
    provider: Prisma.WebhookEventCreateInput["provider"];
    eventId: string;
    eventType: string;
    payload: unknown;
  }) {
    try {
      const webhookEvent = await prisma.webhookEvent.create({
        data: {
          provider: data.provider,
          eventId: data.eventId,
          eventType: data.eventType,
          payload: data.payload as Prisma.InputJsonValue,
          status: "RECEIVED",
        },
      });

      return {
        ...webhookEvent,
        isNew: true,
      };
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      const webhookEvent = await prisma.webhookEvent.findUnique({
        where: {
          provider_eventId: {
            provider: data.provider,
            eventId: data.eventId,
          },
        },
      });

      if (!webhookEvent) {
        throw error;
      }

      return {
        ...webhookEvent,
        isNew: false,
      };
    }
  }

  async findByProviderEventId(data: {
    provider: Prisma.WebhookEventCreateInput["provider"];
    eventId: string;
  }) {
    return prisma.webhookEvent.findUnique({
      where: {
        provider_eventId: {
          provider: data.provider,
          eventId: data.eventId,
        },
      },
    });
  }

  async markProcessing(id: string) {
    return prisma.webhookEvent.update({
      where: { id },
      data: {
        status: "PROCESSING",
        error: null,
      },
    });
  }

  async markProcessed(id: string) {
    return prisma.webhookEvent.update({
      where: { id },
      data: {
        status: "PROCESSED",
        processedAt: new Date(),
        error: null,
      },
    });
  }

  async markFailed(id: string, error: string) {
    return prisma.webhookEvent.update({
      where: { id },
      data: {
        status: "FAILED",
        processedAt: new Date(),
        error,
      },
    });
  }
}
