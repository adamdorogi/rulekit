import { evaluateRuleset } from '../src/evaluate';
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

test('first match stops after a matching rule', () => {
  const result = evaluateRuleset(ruleset, input);
  expect(result.outcome).toBe('review');
  expect(result.matchedRuleIds).toEqual(['young-driver']);
  expect(result.outputs).toEqual({ excess: 1200, currency: 'AUD' });
  expect(result.durationUs).toBeGreaterThanOrEqual(0);
});
