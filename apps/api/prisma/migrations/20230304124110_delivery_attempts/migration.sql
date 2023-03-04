CREATE TABLE "WebhookAttempt" (
    "id" TEXT PRIMARY KEY,
    "deliveryId" TEXT NOT NULL REFERENCES "WebhookDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "generation" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "statusCode" INTEGER,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "WebhookAttempt_deliveryId_generation_number_key" ON "WebhookAttempt"("deliveryId", "generation", "number");
