import { FastifyInstance, FastifyRequest } from 'fastify'
import { Membership, PrismaClient, Role } from '@prisma/client'
import { compare } from 'bcryptjs'
import { z } from 'zod'
import { settings } from './config'
import { HttpError } from './errors'

const sessionCookie = 'rk_session'
const cookie = { path: '/', httpOnly: true, secure: settings.secureCookie, sameSite: 'lax', signed: true } as const
const fallbackHash = '$2a$12$Q0qBLj7SIO/o5CLg4cvFluT46G8tm4OfBlhT8R6oBlHP9PfrKpdUa'
const roleOrder: Record<Role, number> = { viewer: 0, editor: 1, admin: 2 }

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
}
