import { PrismaClient } from '@prisma/client'
import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { member } from './auth'
import { HttpError } from './errors'
import { writeEvent } from './outbox'

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

  app.post<{ Params: { id: string } }>('/v1/reviews/:id/resolve', async (request) => {
    const { workspaceId, userId } = await member(db, request, 'editor')
    const { status, note } = z.object({
      status: z.enum(['approved', 'rejected']),
      note: z.string().trim().max(2000).optional(),
    }).parse(request.body)
    const { id } = request.params
    return db.$transaction(async (tx) => {
      const allowed = { id, evaluation: { project: { workspaceId } } }
      const task = await tx.reviewTask.findFirst({ where: allowed, select: { id: true } })
      if (!task) throw new HttpError(404, 'Review not found')
      const result = await tx.reviewTask.updateMany({
        where: { ...allowed, status: 'pending' },
        data: { status, note, reviewerId: userId, resolvedAt: new Date() },
      })
      if (!result.count) throw new HttpError(409, 'Review already resolved')
      const review = await tx.reviewTask.findUniqueOrThrow({ where: { id }, include: details })
      await writeEvent(tx, workspaceId, 'review.resolved', {
        reviewId: id,
        evaluationId: review.evaluationId,
        projectSlug: review.evaluation.project.slug,
        status,
        note: note || null,
      })
      return review
    })
  })
}
