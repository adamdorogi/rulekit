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
