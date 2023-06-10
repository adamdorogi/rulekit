ALTER TABLE "EvaluationLog" ADD COLUMN "inputHash" TEXT;
ALTER TABLE "EvaluationLog" ADD COLUMN "idempotencyKey" TEXT;
CREATE UNIQUE INDEX "EvaluationLog_projectId_idempotencyKey_key" ON "EvaluationLog"("projectId", "idempotencyKey");
