import { FastifyInstance, FastifyRequest } from 'fastify'
import { Membership, PrismaClient, Role } from '@prisma/client'
import { compare } from 'bcryptjs'
import { z } from 'zod'
import { settings } from './config'
import { newAPIKey, sha256 } from './crypto'
import { HttpError } from './errors'

const sessionCookie = 'rk_session'
const cookie = { path: '/', httpOnly: true, secure: settings.secureCookie, sameSite: 'lax', signed: true } as const
const fallbackHash = '$2a$12$Q0qBLj7SIO/o5CLg4cvFluT46G8tm4OfBlhT8R6oBlHP9PfrKpdUa'
const roleOrder: Record<Role, number> = { viewer: 0, editor: 1, admin: 2 }
const keySelect = { id: true, name: true, prefix: true, createdAt: true, revokedAt: true } as const

export async function member(db: PrismaClient, request: FastifyRequest, minimum: Role = 'viewer') {
  const rawCookie = request.cookies[sessionCookie]
  if (!rawCookie) throw new HttpError(401, 'Sign in to continue')
  const signed = request.unsignCookie(rawCookie)
  if (!signed.valid || !signed.value) throw new HttpError(401, 'Session has expired')
  let token: { sub: string; workspaceId: string }
  try {
    token = request.server.jwt.verify(signed.value)
  } catch {
    throw new HttpError(401, 'Session has expired')
  }
  const membership = await db.membership.findUnique({
    where: { userId_workspaceId: { userId: token.sub, workspaceId: token.workspaceId } },
    include: { user: { select: { email: true } }, workspace: { select: { name: true } } },
  })
  if (!membership) throw new HttpError(401, 'Session has expired')
  if (roleOrder[membership.role] < roleOrder[minimum]) throw new HttpError(403, 'Insufficient workspace access')
  return membership
}

export async function evaluationWorkspace(db: PrismaClient, request: FastifyRequest): Promise<string> {
  const authorization = request.headers.authorization
  const key = /^(?:Bearer) (rk_live_[A-Za-z0-9_-]+)$/i.exec(authorization || '')?.[1]
  if (!key || key.length > 128) throw new HttpError(401, 'API key required')
  const record = await db.apiKey.findUnique({ where: { hash: sha256(key) } })
  if (!record || record.revokedAt) throw new HttpError(401, 'Invalid API key')
  return record.workspaceId
}

function profile(email: string, membership: Membership, workspaceName: string) {
  return { email, role: membership.role, workspaceId: membership.workspaceId, workspaceName }
}

export function authRoutes(app: FastifyInstance, db: PrismaClient): void {
  app.post('/v1/auth/login', async (request, reply) => {
    const body = z.object({
      email: z.string().trim().email().max(254),
      password: z.string().min(1).max(72),
      workspaceId: z.string().max(128).optional(),
    }).parse(request.body)
    const user = await db.user.findUnique({
      where: { email: body.email.toLowerCase() },
      include: {
        memberships: { where: { workspaceId: body.workspaceId }, include: { workspace: true }, orderBy: { workspaceId: 'asc' } },
      },
    })
    const matches = await compare(body.password, user?.passwordHash || fallbackHash)
    const membership = user?.memberships[0]
    if (!matches || !user || !membership) throw new HttpError(401, 'Invalid credentials')
    const token = app.jwt.sign({ sub: user.id, workspaceId: membership.workspaceId }, { expiresIn: '8h' })
    reply.setCookie(sessionCookie, token, { ...cookie, maxAge: 8 * 60 * 60 })
    return profile(user.email, membership, membership.workspace.name)
  })

  app.get('/v1/auth/me', async (request) => {
    const membership = await member(db, request)
    return profile(membership.user.email, membership, membership.workspace.name)
  })

  app.post('/v1/auth/logout', async (_request, reply) => {
    return reply.clearCookie(sessionCookie, cookie).code(204).send()
  })

  app.get('/v1/api-keys', async (request) => {
    const { workspaceId } = await member(db, request, 'admin')
    return db.apiKey.findMany({ where: { workspaceId }, select: keySelect, orderBy: { createdAt: 'desc' } })
  })

  app.post('/v1/api-keys', async (request, reply) => {
    const { workspaceId } = await member(db, request, 'admin')
    const { name } = z.object({ name: z.string().trim().min(1).max(100) }).parse(request.body)
    const key = newAPIKey()
    const row = await db.apiKey.create({
      data: { workspaceId, name, prefix: key.slice(0, 16), hash: sha256(key) },
      select: keySelect,
    })
    return reply.code(201).send({ ...row, key })
  })

  app.delete<{ Params: { id: string } }>('/v1/api-keys/:id', async (request, reply) => {
    const { workspaceId } = await member(db, request, 'admin')
    const changed = await db.apiKey.updateMany({
      where: { workspaceId, id: request.params.id, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    if (!changed.count) throw new HttpError(404, 'Active API key not found')
    return reply.code(204).send()
  })
}
