import { PrismaClient } from '@prisma/client'
import { Job, Queue, Worker } from 'bullmq'
import Redis from 'ioredis'
import pino from 'pino'
import { settings } from './config'
import { deliverWebhook } from './webhook-http'

const queueName = 'rulekit-webhooks'
const maxAttempts = 5
type Task = { id: string; generation: number }

export async function processDelivery(
  db: PrismaClient,
  task: Task,
  send: typeof deliverWebhook = deliverWebhook,
): Promise<void> {
  const row = await db.webhookDelivery.findUnique({
    where: { id: task.id },
    include: { endpoint: true, event: true },
  })
  if (!row || row.generation !== task.generation || row.status !== 'pending') return
  const body = JSON.stringify({ id: row.event.id, type: row.event.type, createdAt: row.event.createdAt, data: row.event.payload })
  const attempt = row.attempts + 1
  let statusCode: number | null = null
  let lastError: string | null = null
  try {
    statusCode = await send(row.endpoint.url, body, row.event.id, row.endpoint.secret)
    if (statusCode < 200 || statusCode >= 300) lastError = `HTTP ${statusCode}`
  } catch (error) {
    lastError = error instanceof Error ? error.message.slice(0, 300) : 'Webhook request failed'
  }
  const status = !lastError ? 'delivered' : attempt >= maxAttempts ? 'dead' : 'pending'
  const updated = await db.$transaction(async (tx) => {
    const changed = await tx.webhookDelivery.updateMany({
      where: { id: row.id, generation: row.generation, attempts: row.attempts, status: 'pending' },
      data: { attempts: attempt, status, statusCode, lastError, attemptedAt: new Date() },
    })
    if (changed.count) {
      await tx.webhookAttempt.create({
        data: { deliveryId: row.id, generation: row.generation, number: attempt, statusCode, error: lastError },
      })
    }
    return changed.count === 1
  })
  if (updated && lastError && status === 'pending') throw new Error(lastError)
}

async function run(): Promise<void> {
  const log = pino()
  const db = new PrismaClient()
  const redis = new Redis(settings.redisUrl, { maxRetriesPerRequest: null })
  const queue = new Queue<Task>(queueName, { connection: redis })
  const worker = new Worker<Task>(queueName, (job: Job<Task>) => processDelivery(db, job.data), {
    connection: redis,
    concurrency: 4,
  })
  let running = true
  let inFlight: Promise<void> | undefined
  let timer: NodeJS.Timeout | undefined
  worker.on('error', (error) => log.error(error, 'webhook worker error'))
  queue.on('error', (error) => log.error(error, 'webhook queue error'))
  redis.on('error', (error) => log.warn(error, 'redis connection error'))

  async function recover(): Promise<void> {
    if (!redis.status.startsWith('ready')) return
    const pending = await db.webhookDelivery.findMany({
      where: { status: 'pending' },
      orderBy: [{ attemptedAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'asc' }],
      take: 200,
      select: { id: true, generation: true, attempts: true },
    })
    if (!pending.length) return
    await queue.addBulk(pending.map(({ id, generation, attempts }) => ({
      name: 'deliver',
      data: { id, generation },
      opts: {
        jobId: `${id}-${generation}`,
        attempts: maxAttempts - attempts,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: true,
        removeOnFail: true,
      },
    })))
  }

  function poll(): void {
    inFlight = recover()
      .catch((error: unknown) => log.error(error, 'outbox dispatch failed'))
      .then(() => { if (running) timer = setTimeout(poll, 1000) })
  }

  async function shutdown(): Promise<void> {
    running = false
    if (timer) clearTimeout(timer)
    await worker.close()
    await inFlight
    await queue.close()
    redis.disconnect()
    await db.$disconnect()
  }

  function stop(): void {
    const deadline = setTimeout(() => process.exit(1), 12000)
    deadline.unref()
    void shutdown().catch((error: unknown) => {
      log.error(error, 'worker shutdown failed')
      process.exitCode = 1
    }).finally(() => clearTimeout(deadline))
  }

  process.once('SIGTERM', stop)
  process.once('SIGINT', stop)
  poll()
}

if (require.main === module) {
  void run().catch((error: unknown) => {
    pino().fatal(error)
    process.exitCode = 1
  })
}
