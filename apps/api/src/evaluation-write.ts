import { Prisma, PrismaClient } from '@prisma/client'
import { EvaluationResult } from '@rulekit/engine'

type EvaluationWrite = {
  workspaceId: string
  projectId: string
  slug: string
  versionId: string
  versionNumber: number
  input: Prisma.InputJsonObject
  inputHash: string
  idempotencyKey?: string
  result: EvaluationResult
}

export async function writeEvaluation(db: PrismaClient, evaluation: EvaluationWrite) {
  const { workspaceId, projectId, slug, versionId, versionNumber, input, inputHash, idempotencyKey, result } = evaluation
  // Every CTE starts from the inserted log, so losing an idempotency race writes no events.
  const [entry] = await db.$queryRaw<{ id: string }[]>`
    WITH logged AS (
      INSERT INTO "EvaluationLog" (
        id, "projectId", "versionId", "versionNumber", input, "inputHash", "idempotencyKey",
        outcome, outputs, "matchedRuleIds", "durationUs", trace
      )
      VALUES (
        gen_random_uuid()::text, ${projectId}, ${versionId}, ${versionNumber}, ${JSON.stringify(input)}::jsonb,
        ${inputHash}, ${idempotencyKey ?? null}, ${result.outcome}::"Outcome", ${JSON.stringify(result.outputs)}::jsonb,
        ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(result.matchedRuleIds)}::jsonb)),
        ${result.durationUs}, ${JSON.stringify(result.trace)}::jsonb
      )
      ON CONFLICT ("projectId", "idempotencyKey") DO NOTHING
      RETURNING id
    ), review AS (
      INSERT INTO "ReviewTask" (id, "evaluationId")
      SELECT gen_random_uuid()::text, id FROM logged WHERE ${result.outcome} = 'review'
      RETURNING id
    ), payload AS (
      SELECT jsonb_build_object(
        'evaluationId', id, 'projectSlug', ${slug}::text, 'version', ${versionNumber}::integer,
        'outcome', ${result.outcome}::text
      ) AS data
      FROM logged
    ), events AS (
      INSERT INTO "OutboxEvent" (id, "workspaceId", type, payload)
      SELECT gen_random_uuid()::text, ${workspaceId}, 'evaluation.completed', data FROM payload
      UNION ALL
      SELECT gen_random_uuid()::text, ${workspaceId}, 'review.created', data || jsonb_build_object('reviewId', review.id)
      FROM payload CROSS JOIN review
      RETURNING id, type
    ), deliveries AS (
      INSERT INTO "WebhookDelivery" (id, "endpointId", "eventId")
      SELECT gen_random_uuid()::text, endpoint.id, events.id
      FROM events
      JOIN "WebhookEndpoint" AS endpoint ON endpoint."workspaceId" = ${workspaceId} AND events.type = ANY(endpoint.events)
    )
    SELECT id FROM logged
  `
  return entry
}
