import { PrismaClient } from '@prisma/client'
import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { member } from './auth'
import { HttpError } from './errors'

const details = {
  evaluation: {
    include: { project: { select: { slug: true, name: true } } },
  },
} as const

export function reviewRoutes(app: FastifyInstance, db: PrismaClient): void {
  app.get('/v1/reviews', async (request) => {
    const { workspaceId } = await member(db, request)
    const { status } = z.object({ status: z.enum(['pending', 'approved', 'rejected']).optional() }).parse(request.query)
    return db.reviewTask.findMany({
      where: { evaluation: { project: { workspaceId } }, status },
      include: details,
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
  })
}
