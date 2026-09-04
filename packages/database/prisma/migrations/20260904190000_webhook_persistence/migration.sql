CREATE TYPE "WebhookEventStatus" AS ENUM (
    'RECEIVED',
    'PROCESSING',
    'PROCESSED',
    'FAILED'
);

CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "status" "WebhookEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "error" TEXT,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WebhookEvent_provider_eventId_key"
    ON "WebhookEvent"("provider", "eventId");

CREATE INDEX "WebhookEvent_provider_eventType_idx"
    ON "WebhookEvent"("provider", "eventType");

CREATE INDEX "WebhookEvent_status_receivedAt_idx"
    ON "WebhookEvent"("status", "receivedAt");

CREATE INDEX "WebhookEvent_receivedAt_idx"
    ON "WebhookEvent"("receivedAt");
