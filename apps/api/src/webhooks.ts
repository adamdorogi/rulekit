import { PrismaClient } from '@prisma/client'
import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { member } from './auth'
import { settings } from './config'
import { endpointSecret } from './crypto'
import { HttpError } from './errors'
import { eventNames } from './outbox'
import { endpointURL } from './webhook-http'

const deliveryDetails = {
  endpoint: { select: { url: true } },
  event: { select: { type: true } },
  attemptLog: { orderBy: [{ generation: 'desc' as const }, { number: 'desc' as const }], take: 20 },
}

export function webhookRoutes(app: FastifyInstance, db: PrismaClient): void {
  app.get('/v1/webhooks', async (request) => {
    const { workspaceId } = await member(db, request, 'admin')
    return db.webhookEndpoint.findMany({ where: { workspaceId }, orderBy: { createdAt: 'desc' } })
  })

  app.post('/v1/webhooks', async (request, reply) => {
    const { workspaceId } = await member(db, request, 'admin')
    const body = z.object({
      url: z.string().trim().min(1).max(2048),
      events: z.array(z.enum(eventNames)).min(1).max(eventNames.length).optional(),
    }).parse(request.body)
    const url = endpointURL(body.url).href
    const row = await db.webhookEndpoint.create({
      data: {
        workspaceId,
        url,
        events: [...new Set(body.events || eventNames)],
        secret: endpointSecret(settings.signingKey),
      },
    })
    return reply.code(201).send(row)
  })

  app.get('/v1/webhooks/deliveries', async (request) => {
    const { workspaceId } = await member(db, request, 'admin')
    return db.webhookDelivery.findMany({
      where: { endpoint: { workspaceId } },
      include: deliveryDetails,
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
  })

  app.post<{ Params: { id: string } }>('/v1/webhooks/deliveries/:id/retry', async (request) => {
    const { workspaceId } = await member(db, request, 'admin')
    const { id } = request.params
    return db.$transaction(async (tx) => {
      const changed = await tx.webhookDelivery.updateMany({
        where: { id, status: 'dead', endpoint: { workspaceId } },
        data: {
          status: 'pending',
          attempts: 0,
          generation: { increment: 1 },
          attemptedAt: null,
          lastError: null,
          statusCode: null,
        },
      })
      if (!changed.count) throw new HttpError(404, 'Dead delivery not found')
      return tx.webhookDelivery.findUniqueOrThrow({ where: { id }, include: deliveryDetails })
    })
  })
}
