import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import cors from '@fastify/cors'
import { PrismaClient } from '@prisma/client'
import { authRoutes } from './auth'
import { settings } from './config'

export async function createServer() {
  const db = new PrismaClient()
  const app = Fastify({ logger: true })
  await app.register(cors, { origin: settings.webOrigin, credentials: true })
  await app.register(cookie, { secret: settings.cookieSecret })
  await app.register(jwt, { secret: settings.jwtSecret, cookie: { cookieName: 'rk_session', signed: true } })
  authRoutes(app, db)
  app.addHook('onClose', async () => { await db.$disconnect() })
  return app
}
