import { strict as assert } from 'node:assert'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'
import { sha256, signature } from './crypto'
import { motorAU, motorInput } from './fixtures'
import { buildServer } from './server'
import { processDelivery } from './worker'

test('API publishes immutable rules and records evaluations, reviews, and deliveries', {
  skip: !process.env.DATABASE_URL && 'DATABASE_URL is required for the integration test',
}, async () => {
  const id = randomUUID()
  const email = `admin-${id}@rulekit.test`
  const userId = `user-${id}`
  const password = 'integration-admin-password'
  const key = `rk_live_${id}`
  const db = new PrismaClient()
  const app = await buildServer({ logger: false })
  const second = await buildServer({ logger: false })
  try {
    await db.workspace.create({ data: { id, name: 'Integration Workspace' } })
    await db.user.create({ data: {
      id: userId, email, passwordHash: await hash(password, 4),
      memberships: { create: { workspaceId: id, role: 'admin' } },
    } })
    await db.apiKey.create({ data: { workspaceId: id, name: 'CI', prefix: key.slice(0, 16), hash: sha256(key) } })
    await Promise.all([app.ready(), second.ready()])
    const login = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email, password } })
    assert.equal(login.statusCode, 200, login.body)
    const cookie = String(login.headers['set-cookie']).split(';')[0]
    const headers = { cookie }
    const apiHeaders = { authorization: `Bearer ${key}`, 'idempotency-key': id }
    const session = await second.inject({ method: 'GET', url: '/v1/auth/me', headers })
    assert.equal(session.json().workspaceId, id)
    const denied = await app.inject({ method: 'GET', url: '/v1/projects' })
    assert.equal(denied.statusCode, 401)

    const endpoint = await app.inject({ method: 'POST', url: '/v1/webhooks', headers, payload: { url: 'https://receiver.example/rulekit' } })
    assert.equal(endpoint.statusCode, 201, endpoint.body)
    const created = await app.inject({ method: 'POST', url: '/v1/projects', headers, payload: { name: 'Test Motor', slug: 'motor' } })
    assert.equal(created.statusCode, 201, created.body)
    const projectId: string = created.json().id
    const save = await app.inject({ method: 'PUT', url: '/v1/projects/motor/draft', headers, payload: { ruleset: motorAU } })
    assert.equal(save.statusCode, 200, save.body)

    const stale = await app.inject({
      method: 'POST', url: '/v1/projects/motor/publish', headers, payload: { expectedChecksum: '0'.repeat(64) },
    })
    assert.equal(stale.statusCode, 409)
    const published = await app.inject({
      method: 'POST', url: '/v1/projects/motor/publish', headers,
      payload: { note: 'v1', expectedChecksum: save.json().checksum },
    })
    assert.equal(published.statusCode, 201, published.body)
    assert.equal(published.json().number, 1)
    assert.match(published.json().checksum, /^[a-f0-9]{64}$/)

    const evaluate = () => second.inject({ method: 'POST', url: '/v1/evaluate/motor', headers: apiHeaders, payload: motorInput })
    const [result, retry] = await Promise.all([evaluate(), evaluate()])
    assert.equal(result.statusCode, 200, result.body)
    assert.equal(retry.statusCode, 200, retry.body)
    assert.deepEqual(retry.json(), result.json())
    assert.equal(result.json().outcome, 'review')
    assert.deepEqual(result.json().matchedRuleIds, ['young-high-value'])
    assert.equal(await db.evaluationLog.count({ where: { projectId } }), 1)
    assert.equal(await db.outboxEvent.count({ where: { workspaceId: id } }), 2)

    const reuse = await app.inject({ method: 'POST', url: '/v1/evaluate/motor', headers: apiHeaders, payload: { applicant: { age: 44 } } })
    assert.equal(reuse.statusCode, 409)
    const deniedKey = await app.inject({ method: 'POST', url: '/v1/evaluate/motor', headers, payload: motorInput })
    assert.equal(deniedKey.statusCode, 401)
    const csv = await app.inject({ method: 'GET', url: '/v1/projects/motor/evaluations?format=csv', headers })
    assert.equal(csv.statusCode, 200, csv.body)
    assert.match(csv.body, /"review"/)
    assert.match(csv.body, /young-high-value/)

    const queue = await app.inject({ method: 'GET', url: '/v1/reviews', headers })
    assert.equal(queue.json().length, 1)
    const review = await app.inject({
      method: 'POST', url: `/v1/reviews/${queue.json()[0].id}/resolve`, headers, payload: { status: 'approved', note: 'Inspected' },
    })
    assert.equal(review.statusCode, 200, review.body)
    assert.equal(await db.outboxEvent.count({ where: { workspaceId: id } }), 3)

    const delivery = await db.webhookDelivery.findFirstOrThrow({ where: { event: { workspaceId: id, type: 'review.resolved' } } })
    await assert.rejects(processDelivery(db, delivery, async () => 502), /502/)
    await processDelivery(db, delivery, async (_url, body, eventId, secret) => {
      assert.equal(JSON.parse(body).id, eventId)
      assert.equal(secret, endpoint.json().secret)
      assert.match(signature(body, secret), /^sha256=[a-f0-9]{64}$/)
      return 200
    })
    const attempts = await db.webhookAttempt.findMany({ where: { deliveryId: delivery.id }, orderBy: { number: 'asc' } })
    assert.deepEqual(attempts.map(({ statusCode }) => statusCode), [502, 200])

    const preview = await app.inject({ method: 'POST', url: `/v1/projects/${projectId}/import-pdf`, headers, payload: { fixture: true, preview: true } })
    assert.equal(preview.statusCode, 200, preview.body)
    assert.equal(preview.json().ruleset.rules.length, 3)
    const draft = await app.inject({ method: 'GET', url: '/v1/projects/motor/draft', headers })
    assert.deepEqual(draft.json().ruleset, motorAU)
    const saveNew = await app.inject({
      method: 'PUT', url: '/v1/projects/motor/draft', headers,
      payload: { ruleset: { mode: 'first_match', defaultOutcome: 'allow', rules: [] } },
    })
    assert.equal(saveNew.statusCode, 200, saveNew.body)
    const publishNew = await app.inject({ method: 'POST', url: '/v1/projects/motor/publish', headers })
    assert.equal(publishNew.statusCode, 201, publishNew.body)
    assert.equal(publishNew.json().number, 2)
    const newOutcome = await second.inject({
      method: 'POST', url: '/v1/evaluate/motor', headers: { authorization: `Bearer ${key}` }, payload: motorInput,
    })
    assert.equal(newOutcome.json().outcome, 'allow')
    assert.equal(newOutcome.json().version, 2)
    const rollback = await app.inject({ method: 'POST', url: '/v1/projects/motor/versions/1/rollback', headers })
    assert.equal(rollback.statusCode, 200, rollback.body)
    const afterRollback = await second.inject({
      method: 'POST', url: '/v1/evaluate/motor', headers: { authorization: `Bearer ${key}` }, payload: motorInput,
    })
    assert.equal(afterRollback.json().outcome, 'review')
    assert.equal(afterRollback.json().version, 1)
  } finally {
    await Promise.all([app.close(), second.close()])
    await db.evaluationLog.deleteMany({ where: { project: { workspaceId: id } } })
    await db.workspace.deleteMany({ where: { id } })
    await db.user.deleteMany({ where: { id: userId } })
    await db.$disconnect()
  }
})
