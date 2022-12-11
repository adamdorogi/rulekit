import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import cors from '@fastify/cors'
import { PrismaClient } from '@prisma/client'
import Redis from 'ioredis'
import { authRoutes } from './auth'
import { invalidationChannel, RulesetCache } from './cache'
import { evaluationRoutes } from './evaluations'
import { settings } from './config'

export async function createServer() {
  const db = new PrismaClient()
  const app = Fastify({ logger: true })
  const redis = new Redis(settings.redisUrl)
  const subscriber = redis.duplicate()
  const cache = new RulesetCache(db, redis)
  await app.register(cors, { origin: settings.webOrigin, credentials: true })
  await app.register(cookie, { secret: settings.cookieSecret })
  await app.register(jwt, { secret: settings.jwtSecret, cookie: { cookieName: 'rk_session', signed: true } })
  await subscriber.subscribe(invalidationChannel)
  subscriber.on('message', (channel, key) => cache.handleMessage(channel, key))
  authRoutes(app, db)
  evaluationRoutes(app, db, cache)
  app.addHook('onClose', async () => {
    await Promise.all([redis.quit(), subscriber.quit(), db.$disconnect()])
  })
  return app
}
