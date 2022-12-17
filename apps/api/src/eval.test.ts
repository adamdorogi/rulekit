import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { evaluateRuleset } from '@rulekit/engine'

test('review evaluations retain the matching rule', () => {
  const result = evaluateRuleset({
    mode: 'first_match',
    defaultOutcome: 'allow',
    rules: [{ id: 'under-25', when: { field: 'age', op: 'lt', value: 25 }, outcome: 'review' }],
  }, { age: 22 })
  assert.equal(result.outcome, 'review')
  assert.deepEqual(result.matchedRuleIds, ['under-25'])
})
