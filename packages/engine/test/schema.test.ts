import { conditionSchema, rulesetSchema } from '../src/schema';

test('validates operator operands and field paths', () => {
  expect(conditionSchema.safeParse({ field: 'a..b', op: 'eq', value: null }).success).toBe(false);
  expect(conditionSchema.safeParse({ field: 'a.b', op: 'eq', value: null }).success).toBe(true);
  expect(conditionSchema.safeParse({ field: 'score', op: 'gt', value: '25' }).success).toBe(false);
  expect(conditionSchema.safeParse({ field: 'score', op: 'in', value: 25 }).success).toBe(false);
  expect(conditionSchema.safeParse({ field: 'score', op: 'exists' }).success).toBe(true);
});

test('rejects conditions with more than one group form', () => {
  expect(conditionSchema.safeParse({ any: [], all: [] }).success).toBe(false);
});

test('rule IDs are unique in a ruleset', () => {
  const rule = { id: 'a', when: { all: [] }, outcome: 'allow' };
  const result = rulesetSchema.safeParse({
    mode: 'first_match', defaultOutcome: 'deny', rules: [rule, rule]
  });
  expect(result.success).toBe(false);
});
