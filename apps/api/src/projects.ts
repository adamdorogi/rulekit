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
