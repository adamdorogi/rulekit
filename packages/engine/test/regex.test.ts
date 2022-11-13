import { compileRegex } from '../src/regex';

test('matches patterns and rejects invalid syntax', () => {
  expect(compileRegex('^[A-Z]{2}$')?.('AU')).toBe(true);
  expect(compileRegex('^[A-Z]{2}$')?.('aus')).toBe(false);
  expect(compileRegex('[')).toBeUndefined();
});
