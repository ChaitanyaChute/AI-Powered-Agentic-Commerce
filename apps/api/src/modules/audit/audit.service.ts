import { logger } from "../../lib/logger.js";

export interface AuditEvent {
  type: string;
  paymentId: string;
  orderId: string;
  customerId: string;
  metadata?: Record<string, unknown>;
}

export class AuditService {
  async record(event: AuditEvent) {
    logger.info(
      {
        audit: event,
      },
      "audit event recorded",
    );
  }
}
