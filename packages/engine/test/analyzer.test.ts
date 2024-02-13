import { analyzeRuleset } from '../src/analyzer';
import { Condition, Operator, Rule, Ruleset } from '../src/types';

const compare = (op: Operator, value: number): Condition => ({ field: 'applicant.age', op, value });
const rule = (id: string, when: Condition): Rule => ({ id, when, outcome: 'review' });
const ruleset = (rules: Rule[], mode: Ruleset['mode'] = 'first_match'): Ruleset => ({
  mode, defaultOutcome: 'allow', rules
});

test('finds contradictory bounds through nested conjunctions', () => {
  const issues = analyzeRuleset(ruleset([
    rule('dead', { all: [compare('gt', 60), { all: [compare('lt', 25)] }] }),
    rule('single-age', { all: [compare('gte', 25), compare('lte', 25)] })
  ]));
  expect(issues).toEqual([expect.objectContaining({
    code: 'contradictory_bounds', severity: 'error', ruleId: 'dead', field: 'applicant.age'
  })]);
});

test('skips a contradictory alternative if another can match', () => {
  expect(analyzeRuleset(ruleset([rule('alternate', { any: [
    { all: [compare('gt', 60), compare('lt', 25)] },
    compare('eq', 45)
  ] })]))).toEqual([]);
});

test('detects shadowed ranges and partial overlap', () => {
  const rules = [
    rule('wide', compare('lt', 60)),
    rule('shadowed', compare('lte', 25)),
    rule('crosses', compare('gte', 55))
  ];
  expect(analyzeRuleset(ruleset(rules))).toEqual([
    expect.objectContaining({ code: 'shadowed_rule', ruleId: 'shadowed', relatedRuleId: 'wide' }),
    expect.objectContaining({ code: 'overlapping_bounds', ruleId: 'crosses', relatedRuleId: 'wide' })
  ]);
  expect(analyzeRuleset(ruleset(rules, 'all_matches'))).toEqual([]);
});

test('ignores a boundary where the ranges do not intersect', () => {
  expect(analyzeRuleset(ruleset([
    rule('young', compare('lt', 25)),
    rule('older', compare('gte', 25))
  ]))).toEqual([]);
});

test('checks other numeric fields before reporting an overlap', () => {
  const value = (op: Operator, amount: number): Condition => ({
    field: 'vehicle.value_aud', op, value: amount
  });
  expect(analyzeRuleset(ruleset([
    rule('older-low-value', { all: [compare('gte', 25), value('lt', 85000)] }),
    rule('young-high-value', { all: [compare('lt', 30), value('gte', 85000)] })
  ]))).toEqual([]);
});

test('detects reordered groups and repeated conditions', () => {
  const market = { field: 'market', op: 'eq', value: 'AU' } as const;
  const rules = [
    rule('first', { all: [market, compare('gte', 25)] }),
    rule('later', { all: [compare('gte', 25), market, market] })
  ];
  expect(analyzeRuleset(ruleset(rules)).map(issue => issue.code))
    .toEqual(['duplicate_condition', 'shadowed_rule']);
});

test('does not confuse empty arrays with empty objects', () => {
  expect(analyzeRuleset(ruleset([
    rule('array', { field: 'x', op: 'eq', value: [] }),
    rule('object', { field: 'x', op: 'eq', value: {} })
  ]))).toEqual([]);
});
