import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import { Prisma, PrismaClient } from '@prisma/client'
import Fastify, { FastifyServerOptions } from 'fastify'
import Redis from 'ioredis'
import { ZodError } from 'zod'
import { authRoutes } from './auth'
import { invalidationChannel, RulesetCache } from './cache'
import { settings } from './config'
import { HttpError } from './errors'
import { evaluationRoutes } from './evaluations'
import { importRoutes } from './importer'
import { Metrics } from './metrics'
import { projectRoutes } from './projects'
import { reviewRoutes } from './reviews'
import { webhookRoutes } from './webhooks'

export async function buildServer(options: FastifyServerOptions = {}) {
  const app = Fastify({
    logger: { redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'] },
    ...options,
  })
  const db = new PrismaClient()
  const redis = new Redis(settings.redisUrl, { enableOfflineQueue: false, maxRetriesPerRequest: 1 })
  const subscriber = redis.duplicate()
  const cache = new RulesetCache(db, redis)
  const metrics = new Metrics()
  const allowedOrigins = settings.webOrigin.split(',').map((origin) => origin.trim())

  for (const connection of [redis, subscriber]) {
    connection.on('error', (error) => app.log.warn(error, 'redis connection error'))
  }
  subscriber.on('ready', () => {
    cache.clear()
    void subscriber.subscribe(invalidationChannel).catch((error: unknown) => app.log.warn(error, 'cache subscription failed'))
  })
  subscriber.on('close', () => cache.clear())
  subscriber.on('message', (channel, payload) => cache.handleMessage(channel, payload))

  app.addHook('onClose', async () => {
    subscriber.disconnect()
    redis.disconnect()
    await db.$disconnect()
  })
  app.addHook('onRequest', async (request) => {
    if (request.headers.origin && !['GET', 'HEAD', 'OPTIONS'].includes(request.method)
      && !allowedOrigins.includes(request.headers.origin)) {
      throw new HttpError(403, 'Request origin is not allowed')
    }
  })
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({ error: 'Invalid request', details: error.issues })
    }
    if (error instanceof HttpError) {
      return reply.code(error.statusCode).send({ error: error.message, details: error.details })
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return reply.code(409).send({ error: 'A record with that value already exists' })
    }
    if (error.statusCode && error.statusCode < 500) {
      return reply.code(error.statusCode).send({ error: error.message })
    }
    request.log.error(error)
    return reply.code(500).send({ error: 'Request failed' })
  })

  await app.register(cors, { origin: allowedOrigins, credentials: true, methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'OPTIONS'] })
  await app.register(cookie, { secret: settings.cookieSecret })
  await app.register(jwt, { secret: settings.jwtSecret, cookie: { cookieName: 'rk_session', signed: true } })

  app.get('/healthz', async (_request, reply) => {
    const checks = await Promise.allSettled([db.$queryRaw`SELECT 1`, redis.ping()])
    const [postgres, cacheStatus] = checks.map((check) => check.status === 'fulfilled' ? 'ok' : 'unavailable')
    const healthy = postgres === 'ok' && cacheStatus === 'ok'
    return reply.code(healthy ? 200 : 503).send({ status: healthy ? 'ok' : 'unavailable', postgres, redis: cacheStatus })
  })
  app.get('/metrics', (_request, reply) => reply.type('text/plain; version=0.0.4; charset=utf-8').send(metrics.render()))
  authRoutes(app, db)
  projectRoutes(app, db, cache)
  evaluationRoutes(app, db, cache, metrics)
  reviewRoutes(app, db)
  webhookRoutes(app, db)
  importRoutes(app, db)
  return app
}
