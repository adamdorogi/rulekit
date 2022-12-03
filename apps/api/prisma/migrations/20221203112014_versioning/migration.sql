CREATE TYPE "Outcome" AS ENUM ('allow', 'deny', 'review');

CREATE TABLE "Draft" (
    "projectId" TEXT PRIMARY KEY REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "ruleset" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "RulesetVersion" (
    "id" TEXT PRIMARY KEY,
    "projectId" TEXT NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "number" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "ruleset" JSONB NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "RulesetVersion_projectId_number_key" ON "RulesetVersion"("projectId", "number");

ALTER TABLE "Project" ADD COLUMN "activeVersionId" TEXT REFERENCES "RulesetVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "Project_activeVersionId_key" ON "Project"("activeVersionId");

CREATE TABLE "EvaluationLog" (
    "id" TEXT PRIMARY KEY,
    "projectId" TEXT NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "versionId" TEXT NOT NULL REFERENCES "RulesetVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    "versionNumber" INTEGER NOT NULL,
    "input" JSONB NOT NULL,
    "outputs" JSONB NOT NULL,
    "matchedRuleIds" TEXT[] NOT NULL,
    "outcome" "Outcome" NOT NULL,
    "durationUs" INTEGER NOT NULL,
    "trace" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "EvaluationLog_projectId_createdAt_idx" ON "EvaluationLog"("projectId", "createdAt");
