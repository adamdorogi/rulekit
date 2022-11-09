import { equal } from './equality';
import { missing } from './path';
import { Check } from './types';

type Predicate = (actual: unknown) => boolean;
type CompareNumbers = (actual: number, expected: number) => boolean;

function compare(expected: unknown, operation: CompareNumbers): Predicate {
  return actual => {
    if (typeof actual !== 'number' && typeof actual !== 'string') return false;
    return typeof expected === 'number' && operation(Number(actual), expected);
  };
}

function makePredicate({ op, value }: Check): Predicate {
  switch (op) {
    case 'eq': return actual => equal(actual, value);
    case 'neq': return actual => !equal(actual, value);
    case 'gt': return compare(value, (actual, expected) => actual > expected);
    case 'lt': return compare(value, (actual, expected) => actual < expected);
  }
}

export function compilePredicate(check: Check): Predicate {
  const test = makePredicate(check);
  return actual => actual !== missing && test(actual);
}
