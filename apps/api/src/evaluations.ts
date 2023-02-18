import { Prisma, PrismaClient } from '@prisma/client'
import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { evaluationWorkspace, member } from './auth'
import { RulesetCache } from './cache'
import { HttpError } from './errors'
import { Metrics } from './metrics'
import { projectForSlug } from './projects'

export function evaluationRoutes(app: FastifyInstance, db: PrismaClient, cache: RulesetCache, metrics: Metrics): void {
  app.post<{ Params: { slug: string } }>('/v1/evaluate/:slug', async (request, reply) => {
    const workspaceId = await evaluationWorkspace(db, request)
    const { slug } = request.params
    const input = z.record(z.unknown()).parse(request.body) as Prisma.InputJsonObject
    const { version, hit } = await cache.get(workspaceId, slug)
    const result = version.evaluate(input)
    const log = await db.$transaction(async (tx) => {
        const entry = await tx.evaluationLog.create({
          data: {
            projectId: version.projectId,
            versionId: version.id,
            versionNumber: version.number,
            input,
            outcome: result.outcome,
            outputs: result.outputs as Prisma.InputJsonObject,
            matchedRuleIds: result.matchedRuleIds,
            durationUs: result.durationUs,
            trace: JSON.parse(JSON.stringify(result.trace)) as Prisma.InputJsonArray,
          },
        })
        if (result.outcome === 'review') {
          await tx.reviewTask.create({ data: { evaluationId: entry.id } })
        }
        return entry
      })
      metrics.record(result.outcome, result.durationUs, hit)
    return { ...result, evaluationId: log.id, version: log.versionNumber }
  })
}
