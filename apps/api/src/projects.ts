import { FastifyInstance } from 'fastify'
import { Prisma, PrismaClient } from '@prisma/client'
import { evaluateRuleset, rulesetSchema } from '@rulekit/engine'
import { z } from 'zod'
import { member } from './auth'
import { RulesetCache } from './cache'
import { canonicalJson, sha256 } from './crypto'
import { HttpError } from './errors'

const ttl24h = 24 * 60 * 60 * 1000
const projectDetails = {
  activeVersion: true,
  draft: true,
} as const
const projectBody = z.object({
  slug: z.string().trim().min(1).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().trim().min(1).max(100),
  mode: z.enum(['first_match', 'all_matches']).default('first_match'),
})
type ProjectRow = Prisma.ProjectGetPayload<{ include: typeof projectDetails }>

function summary(row: ProjectRow, evaluations24h = 0) {
  const content = rulesetSchema.safeParse((row.activeVersion || row.draft)?.ruleset)
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    activeVersion: row.activeVersion?.number ?? null,
    mode: content.success ? content.data.mode : 'first_match',
    evaluations24h,
    lastPublished: row.activeVersion?.createdAt ?? null,
  }
}

export async function projectForSlug(db: PrismaClient, workspaceId: string, slug: string) {
  const result = await db.project.findUnique({ where: { workspaceId_slug: { workspaceId, slug } }, include: projectDetails })
  if (!result) throw new HttpError(404, 'Project not found')
  return result
}

function draftContents(draft: { ruleset: Prisma.JsonValue }) {
  const ruleset = rulesetSchema.parse(draft.ruleset)
  return { ...draft, ruleset, issues: [] }
}

export function projectRoutes(app: FastifyInstance, db: PrismaClient, cache: RulesetCache): void {
  app.get('/v1/projects', async (request) => {
    const { workspaceId } = await member(db, request)
    const [projects, evaluationCounts] = await Promise.all([
      db.project.findMany({ where: { workspaceId }, include: projectDetails, orderBy: { slug: 'asc' } }),
      db.evaluationLog.groupBy({
        by: ['projectId'],
        where: { project: { workspaceId }, createdAt: { gte: new Date(Date.now() - ttl24h) } },
        _count: { _all: true },
      }),
    ])
    const counts = new Map(evaluationCounts.map(({ projectId, _count }) => [projectId, _count._all]))
    return projects.map((project) => summary(project, counts.get(project.id)))
  })

  app.post('/v1/projects', async (request, reply) => {
    const { workspaceId } = await member(db, request, 'editor')
    const { slug, name, mode } = projectBody.parse(request.body)
    const row = await db.project.create({
      data: { workspaceId, slug, name, draft: { create: { ruleset: { mode, rules: [], defaultOutcome: 'review' } } } },
      include: projectDetails,
    })
    return reply.code(201).send(summary(row))
  })

  app.get<{ Params: { slug: string } }>('/v1/projects/:slug', async (request) => {
    const { workspaceId } = await member(db, request)
    const project = await projectForSlug(db, workspaceId, request.params.slug)
    const count = await db.evaluationLog.count({
      where: { projectId: project.id, createdAt: { gte: new Date(Date.now() - ttl24h) } },
    })
    return summary(project, count)
  })

  app.get<{ Params: { slug: string } }>('/v1/projects/:slug/draft', async (request) => {
    const { workspaceId } = await member(db, request)
    const project = await projectForSlug(db, workspaceId, request.params.slug)
    if (!project.draft) throw new HttpError(404, 'Draft not found')
    return draftContents(project.draft)
  })

  app.put<{ Params: { slug: string } }>('/v1/projects/:slug/draft', async (request) => {
    const { workspaceId } = await member(db, request, 'editor')
    const project = await projectForSlug(db, workspaceId, request.params.slug)
    const { ruleset } = z.object({
      ruleset: rulesetSchema,
    }).parse(request.body)
    const json = ruleset as unknown as Prisma.InputJsonObject
    const draft = await db.draft.upsert({
      where: { projectId: project.id },
      update: { ruleset: json },
      create: { projectId: project.id, ruleset: json },
    })
    return draftContents(draft)
  })

  app.post<{ Params: { slug: string } }>('/v1/projects/:slug/publish', async (request, reply) => {
    const { workspaceId } = await member(db, request, 'editor')
    const { slug } = request.params
    const project = await projectForSlug(db, workspaceId, slug)
    const { note } = z.object({ note: z.string().trim().max(2000).optional() }).parse(request.body || {})
    const version = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Project" WHERE id = ${project.id} FOR UPDATE`
      const draft = await tx.draft.findUnique({ where: { projectId: project.id } })
      if (!draft) throw new HttpError(404, 'Draft not found')
      const ruleset = rulesetSchema.parse(draft.ruleset)
      const last = await tx.rulesetVersion.findFirst({ where: { projectId: project.id }, orderBy: { number: 'desc' } })
      const release = await tx.rulesetVersion.create({
        data: {
          projectId: project.id,
          number: (last?.number || 0) + 1,
          note,
          ruleset: ruleset as unknown as Prisma.InputJsonObject,
          checksum: sha256(canonicalJson(ruleset)),
        },
      })
      await tx.project.update({ where: { id: project.id }, data: { activeVersionId: release.id } })
      return release
    })
    await cache.publish(workspaceId, slug).catch((error) => request.log.warn(error, 'cache invalidation failed'))
    return reply.code(201).send(version)
  })
}
