import { EvaluationLog, Prisma, PrismaClient } from '@prisma/client'
import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { evaluationWorkspace, member } from './auth'
import { RulesetCache } from './cache'
import { canonicalJson, sha256 } from './crypto'
import { HttpError } from './errors'
import { Metrics } from './metrics'
import { writeEvaluation } from './evaluation-write'
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

function csvCell(value: string | number): string {
  const raw = String(value)
  const safe = /^[\s]*[=+\-@]/.test(raw) || /^[\t\r\n]/.test(raw) ? `'${raw}` : raw
  return `"${safe.replace(/"/g, '""')}"`
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
    const entry = await writeEvaluation(db, {
      workspaceId, projectId: version.projectId, slug, versionId: version.id, versionNumber: version.number,
      input, inputHash, idempotencyKey, result,
    })
    if (entry) {
      metrics.record(result.outcome, result.durationUs, hit)
      return { ...result, evaluationId: entry.id, version: version.number }
    }
    const previous = idempotencyKey && await findLog(idempotencyKey)
    if (!previous) throw new HttpError(409, 'Evaluation was already recorded')
    reply.header('idempotency-replayed', 'true')
    return resultOf(previous, inputHash)
  })

  app.get<{ Params: { slug: string }; Querystring: { format?: string } }>(
    '/v1/projects/:slug/evaluations', async (request, reply) => {
      const { workspaceId } = await member(db, request)
      const { slug } = request.params
      const format = z.enum(['json', 'csv']).default('json').parse(request.query.format)
      const project = await projectForSlug(db, workspaceId, slug)
      const logs = await db.evaluationLog.findMany({
        where: { projectId: project.id },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 1000,
      })
      reply.header('content-disposition', `attachment; filename="${slug}-evaluations.${format}"`)
      if (format === 'json') return logs
      const csv = [
        'id,createdAt,version,outcome,durationUs,input,matchedRuleIds,outputs',
        ...logs.map((log) => [
          log.id, log.createdAt.toISOString(), log.versionNumber, log.outcome, log.durationUs,
          JSON.stringify(log.input), JSON.stringify(log.matchedRuleIds), JSON.stringify(log.outputs),
        ].map(csvCell).join(',')),
      ].join('\r\n')
      return reply.type('text/csv; charset=utf-8').send(csv)
    },
  )
}
