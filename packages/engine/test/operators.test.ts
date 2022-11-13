import { compilePredicate } from '../src/operators';
import { missing } from '../src/path';
import { Operator } from '../src/types';

function testValue(op: Operator, value: unknown, actual: unknown): boolean {
  return compilePredicate({ field: 'x', op, value })(actual);
}

describe('equality', () => {
  test('compares JSON structures without coercing types', () => {
    expect(testValue('eq', { limits: [1, null], active: true }, { active: true, limits: [1, null] })).toBe(true);
    expect(testValue('eq', 21, '21')).toBe(false);
    expect(testValue('eq', {}, [])).toBe(false);
    expect(testValue('neq', false, 0)).toBe(true);
    expect(testValue('neq', null, missing)).toBe(false);
  });
});

describe('numeric comparisons', () => {
  test.each([
    ['gt', 26, true], ['gt', 25, false],
    ['gte', 25, true], ['gte', 24, false],
    ['lt', 24, true], ['lt', 25, false],
    ['lte', 25, true], ['lte', 26, false]
  ] as [Operator, number, boolean][])('%s with %s', (op, actual, expected) => {
    expect(testValue(op, 25, actual)).toBe(expected);
  });

  test('does not coerce strings, null, or booleans to numbers', () => {
    expect(testValue('gt', 25, '26')).toBe(false);
    expect(testValue('lt', 25, null)).toBe(false);
    expect(testValue('lt', 25, false)).toBe(false);
    expect(testValue('gt', 25, Infinity)).toBe(false);
  });
});

describe('membership and presence', () => {
  test('handles arrays and string containment', () => {
    expect(testValue('in', ['AU', 'NZ'], 'AU')).toBe(true);
    expect(testValue('not_in', ['AU', 'NZ'], 'GB')).toBe(true);
    expect(testValue('in', [{ code: 'AU' }], { code: 'AU' })).toBe(true);
    expect(testValue('contains', 'trade', 'retail trade')).toBe(true);
    expect(testValue('contains', 3, [1, 3])).toBe(true);
    expect(testValue('contains', 3, '31')).toBe(false);
  });

  test('distinguishes missing fields from null', () => {
    expect(testValue('exists', undefined, null)).toBe(true);
    expect(testValue('exists', false, null)).toBe(false);
    expect(testValue('exists', false, missing)).toBe(true);
    expect(testValue('not_in', [null], missing)).toBe(false);
  });
});
