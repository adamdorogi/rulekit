import { EvaluationLog, Prisma, PrismaClient } from '@prisma/client'
import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { evaluationWorkspace, member } from './auth'
import { RulesetCache } from './cache'
import { canonicalJson, sha256 } from './crypto'
import { HttpError } from './errors'
import { Metrics } from './metrics'
import { writeEvent } from './outbox'
import { projectForSlug } from './projects'

function resultOf(log: EvaluationLog, inputHash: string) {
  if ((log.inputHash || sha256(canonicalJson(log.input))) !== inputHash) {
    throw new HttpError(409, 'Idempotency key already used for a different input')
  }
  return {
    evaluationId: log.id,
    version: log.versionNumber,
    outcome: log.outcome,
    outputs: log.outputs,
    matchedRuleIds: log.matchedRuleIds,
    durationUs: log.durationUs,
    trace: log.trace,
  }
}

export function evaluationRoutes(app: FastifyInstance, db: PrismaClient, cache: RulesetCache, metrics: Metrics): void {
  app.post<{ Params: { slug: string } }>('/v1/evaluate/:slug', async (request, reply) => {
    const workspaceId = await evaluationWorkspace(db, request)
    const { slug } = request.params
    const input = z.record(z.unknown()).parse(request.body) as Prisma.InputJsonObject
    const idempotencyKey = z.string().trim().min(1).max(128).optional().parse(request.headers['idempotency-key'])
    const inputHash = sha256(canonicalJson(input))
    const { version, hit } = await cache.get(workspaceId, slug)
    const findLog = (key: string) => db.evaluationLog.findUnique({
      where: { projectId_idempotencyKey: { projectId: version.projectId, idempotencyKey: key } },
    })
    if (idempotencyKey) {
      const previous = await findLog(idempotencyKey)
      if (previous) {
        reply.header('idempotency-replayed', 'true')
        return resultOf(previous, inputHash)
      }
    }
    const result = version.evaluate(input)
    try {
      const log = await db.$transaction(async (tx) => {
        const entry = await tx.evaluationLog.create({
          data: {
            projectId: version.projectId,
            versionId: version.id,
            versionNumber: version.number,
            input,
            inputHash,
            idempotencyKey,
            outcome: result.outcome,
            outputs: result.outputs as Prisma.InputJsonObject,
            matchedRuleIds: result.matchedRuleIds,
            durationUs: result.durationUs,
            trace: JSON.parse(JSON.stringify(result.trace)) as Prisma.InputJsonArray,
          },
        })
        const payload = { evaluationId: entry.id, projectSlug: slug, version: version.number, outcome: result.outcome }
        await writeEvent(tx, workspaceId, 'evaluation.completed', payload)
        if (result.outcome === 'review') {
          const review = await tx.reviewTask.create({ data: { evaluationId: entry.id } })
          await writeEvent(tx, workspaceId, 'review.created', { ...payload, reviewId: review.id })
        }
        return entry
      })
      metrics.record(result.outcome, result.durationUs, hit)
      return resultOf(log, inputHash)
    } catch (error) {
      if (idempotencyKey && error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const previous = await findLog(idempotencyKey)
        if (previous) {
          reply.header('idempotency-replayed', 'true')
          return resultOf(previous, inputHash)
        }
      }
      throw error
    }
  })
}
