import { evaluateRuleset } from '../src/evaluate';
import { compileRegex } from '../src/regex';
import { conditionSchema, rulesetSchema, storedRulesetSchema } from '../src/schema';

test('matches bounded expressions and simple alternatives', () => {
  const test = compileRegex('^(AU|NZ)-[0-9]{4}$');
  expect(test?.('AU-2000')).toBe(true);
  expect(test?.('GB-2000')).toBe(false);
  expect(compileRegex('^A+$')?.('AAAA')).toBe(true);
  expect(compileRegex('^A+$')?.('A'.repeat(513))).toBe(false);
});

test('keeps published versions readable with unsupported patterns', () => {
  const stored = {
    mode: 'first_match',
    defaultOutcome: 'review',
    rules: [{
      id: 'legacy', outcome: 'deny',
      when: { field: 'brandCode', op: 'regex', value: '(AU|NZ)+' }
    }]
  };
  expect(rulesetSchema.safeParse(stored).success).toBe(false);
  const ruleset = storedRulesetSchema.parse(stored);
  expect(evaluateRuleset(ruleset, { brandCode: 'AU' })).toMatchObject({
    outcome: 'review',
    matchedRuleIds: [],
    trace: [{ passed: false }]
  });
});

test('rejects invalid and expensive expressions', () => {
  const patterns = ['[', 'a'.repeat(129), '(a+)+$', '(a|aa){20}b', '(a|a)(a|a)b', 'a+a+a+b', '(a)\\1'];
  for (const value of patterns) {
    expect(compileRegex(value)).toBeUndefined();
    expect(conditionSchema.safeParse({ field: 'name', op: 'regex', value }).success).toBe(false);
  }
});
