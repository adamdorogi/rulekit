import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { PrismaClient } from '@prisma/client'
import Redis from 'ioredis'
import { invalidationChannel, RulesetCache } from './cache'

test('a Redis invalidation discards the active pointer on another instance', async () => {
  let id = 'v1'
  let reads = 0
  const db = {
    project: { findUnique: async () => { reads++; return { id: 'project', activeVersionId: id } } },
    rulesetVersion: { findUniqueOrThrow: async () => ({
      id,
      number: id === 'v1' ? 1 : 2,
      ruleset: { mode: 'first_match', defaultOutcome: 'allow', rules: [] },
    }) },
  } as unknown as PrismaClient
  let receiver: RulesetCache
  const redis = {
    publish: async (channel: string, key: string) => receiver.handleMessage(channel, key),
  } as unknown as Redis
  const publisher = new RulesetCache(db, redis)
  receiver = new RulesetCache(db, redis)
  assert.equal((await receiver.get('tenant', 'motor')).version.number, 1)
  assert.equal((await receiver.get('tenant', 'motor')).hit, true)
  assert.equal(reads, 1)
  id = 'v2'
  await publisher.publish('tenant', 'motor')
  assert.equal((await receiver.get('tenant', 'motor')).version.number, 2)
  assert.equal(reads, 2)
  receiver.handleMessage(invalidationChannel, 'other-tenant:motor')
  assert.equal((await receiver.get('tenant', 'motor')).hit, true)
})
