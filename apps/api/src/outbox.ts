import { Prisma } from '@prisma/client'

export const eventNames = ['evaluation.completed', 'review.created', 'review.resolved'] as const

export async function writeEvent(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  type: typeof eventNames[number],
  payload: Prisma.InputJsonObject,
): Promise<void> {
  const endpoints = await tx.webhookEndpoint.findMany({
    where: { workspaceId, events: { has: type } },
    select: { id: true },
  })
  await tx.outboxEvent.create({
    data: {
      workspaceId,
      type,
      payload,
      deliveries: { create: endpoints.map(({ id }) => ({ endpointId: id })) },
    },
  })
}
