import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { analyzeRuleset } from '@rulekit/engine'
import { extractRows, fixtureText } from './importer/offline'

test('offline fixture extracts numeric thresholds and source line references', () => {
  const result = extractRows(fixtureText)
  assert.equal(result.rules.length, 3)
  assert.deepEqual(result.rules[0].when, { field: 'applicant.age', op: 'lt', value: 25 })
  assert.equal(result.rules[0].name, 'Policy line 2')
  assert.equal(extractRows('if vehicle.value_aud > $85,000 then review').rules.length, 1)
})

test('offline policy rows can be checked for shadowing', () => {
  const ruleset = extractRows('age >= 20 -> review\nage >= 25 -> deny')
  assert.equal(analyzeRuleset(ruleset).some(({ code }) => code === 'shadowed_rule'), true)
})
