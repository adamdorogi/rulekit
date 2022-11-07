import { missing, resolvePath } from '../src/path';

test('resolves own object properties and array indices', () => {
  const input = { applicant: { drivers: [{ age: 22 }] }, active: false };
  expect(resolvePath(input, ['applicant', 'drivers', '0', 'age'])).toBe(22);
  expect(resolvePath(input, ['active'])).toBe(false);
  expect(resolvePath(input, ['applicant', 'drivers', 'length'])).toBe(missing);
  expect(resolvePath(input, ['constructor'])).toBe(missing);
});
