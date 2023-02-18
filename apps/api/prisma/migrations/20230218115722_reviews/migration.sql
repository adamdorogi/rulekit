CREATE TYPE "ReviewStatus" AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE "ReviewTask" (
    "id" TEXT PRIMARY KEY,
    "evaluationId" TEXT NOT NULL REFERENCES "EvaluationLog"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "status" "ReviewStatus" NOT NULL DEFAULT 'pending',
    "reviewerId" TEXT REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX "ReviewTask_evaluationId_key" ON "ReviewTask"("evaluationId");
