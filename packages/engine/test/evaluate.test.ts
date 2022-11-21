import { compileRuleset, evaluateRuleset } from '../src/evaluate';
import { Ruleset } from '../src/types';

const ruleset: Ruleset = {
  mode: 'first_match',
  defaultOutcome: 'allow',
  defaultOutputs: { excess: 500, currency: 'AUD' },
  rules: [
    {
      id: 'young-driver',
      outcome: 'review',
      outputs: { excess: 1200 },
      when: { all: [
        { field: 'applicant.age', op: 'lt', value: 25 },
        { any: [
          { field: 'vehicle.value_aud', op: 'gt', value: 85000 },
          { field: 'history.claims_count', op: 'gte', value: 2 }
        ] },
        { not: { field: 'applicant.extra_driver', op: 'exists' } }
      ] }
    },
    {
      id: 'recent-claims',
      outcome: 'deny',
      outputs: { excess: 2000 },
      when: { field: 'history.claims_count', op: 'gte', value: 2 }
    }
  ]
};

const input = {
  applicant: { age: 21 },
  vehicle: { value_aud: 65000 },
  history: { claims_count: 2 }
};

test('first match traces visited checks through nested groups', () => {
  const result = evaluateRuleset(ruleset, input);
  expect(result.outcome).toBe('review');
  expect(result.matchedRuleIds).toEqual(['young-driver']);
  expect(result.outputs).toEqual({ excess: 1200, currency: 'AUD' });
  expect(result.trace.map(step => step.passed)).toEqual([true, false, true, false]);
  expect(result.trace[1]).toEqual({
    ruleId: 'young-driver', field: 'vehicle.value_aud', op: 'gt',
    actual: 65000, expected: 85000, passed: false
  });
  expect(result.trace[3]).toMatchObject({ actual: null, expected: true, missing: true });
  expect(result.durationUs).toBeGreaterThanOrEqual(0);
});

test('all matches accumulates outputs in order and uses the strongest outcome', () => {
  const evaluate = compileRuleset({ ...ruleset, mode: 'all_matches' });
  expect(evaluate(input)).toMatchObject({
    outcome: 'deny',
    matchedRuleIds: ['young-driver', 'recent-claims'],
    outputs: { excess: 2000, currency: 'AUD' }
  });
  expect(evaluate({})).toMatchObject({
    outcome: 'allow', matchedRuleIds: [], outputs: { excess: 500, currency: 'AUD' }
  });
});
