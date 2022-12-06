import { compileRuleset, rulesetSchema } from '@rulekit/engine'
import { PrismaClient } from '@prisma/client'
import Redis from 'ioredis'
import LRUCache from 'lru-cache'
import { HttpError } from './errors'

export const invalidationChannel = 'rulekit:invalidate'

type Evaluator = ReturnType<typeof compileRuleset>
type ActiveVersion = { projectId: string; id: string; number: number; evaluate: Evaluator }

export class RulesetCache {
  private readonly active = new LRUCache<string, string>({ max: 1000, ttl: 5000 })
  private readonly compiled = new LRUCache<string, ActiveVersion>({ max: 1000 })

  private epoch = 0

  constructor(private readonly db: PrismaClient, private readonly redis: Redis) {}

  async get(workspaceId: string, slug: string): Promise<{ version: ActiveVersion; hit: boolean }> {
    const pointerKey = `${workspaceId}:${slug}`
    const cachedPointer = this.active.get(pointerKey)
    if (cachedPointer) {
      const hit = this.compiled.get(`${pointerKey}:${cachedPointer}`)
      if (hit) return { version: hit, hit: true }
    }
    const epoch = this.epoch
    const project = await this.db.project.findUnique({
      where: { workspaceId_slug: { workspaceId, slug } },
      select: { id: true, activeVersionId: true },
    })
    if (!project) throw new HttpError(404, 'Project not found')
    if (!project.activeVersionId) throw new HttpError(409, 'No published version')
    const versionKey = `${pointerKey}:${project.activeVersionId}`
    const existing = this.compiled.get(versionKey)
    if (existing) {
      if (epoch === this.epoch) this.active.set(pointerKey, existing.id)
      return { version: existing, hit: false }
    }
    const row = await this.db.rulesetVersion.findUniqueOrThrow({ where: { id: project.activeVersionId } })
    const version = {
      projectId: project.id,
      id: row.id,
      number: row.number,
      evaluate: compileRuleset(rulesetSchema.parse(row.ruleset)),
    }
    this.compiled.set(versionKey, version)
    // Do not refill a pointer invalidated while its database read was in flight.
    if (epoch === this.epoch) this.active.set(pointerKey, row.id)
    return { version, hit: false }
  }

}
