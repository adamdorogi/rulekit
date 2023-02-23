CREATE TYPE "DeliveryStatus" AS ENUM ('pending', 'delivered', 'dead');

CREATE TABLE "WebhookEndpoint" (
    "id" TEXT PRIMARY KEY,
    "workspaceId" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "url" TEXT NOT NULL,
    "events" TEXT[] NOT NULL,
    "secret" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "OutboxEvent" (
    "id" TEXT PRIMARY KEY,
    "workspaceId" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "WebhookDelivery" (
    "id" TEXT PRIMARY KEY,
    "endpointId" TEXT NOT NULL REFERENCES "WebhookEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "eventId" TEXT NOT NULL REFERENCES "OutboxEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "generation" INTEGER NOT NULL DEFAULT 0,
    "statusCode" INTEGER,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attemptedAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX "WebhookDelivery_eventId_endpointId_key" ON "WebhookDelivery"("eventId", "endpointId");
CREATE INDEX "WebhookDelivery_status_attemptedAt_idx" ON "WebhookDelivery"("status", "attemptedAt");
