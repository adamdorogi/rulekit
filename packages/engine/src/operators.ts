import { equal } from './equality';
import { missing } from './path';
import { Check } from './types';

type Predicate = (actual: unknown) => boolean;
type CompareNumbers = (actual: number, expected: number) => boolean;

function compare(expected: unknown, operation: CompareNumbers): Predicate {
  return actual => typeof actual === 'number' && Number.isFinite(actual) &&
    typeof expected === 'number' && Number.isFinite(expected) && operation(actual, expected);
}

function makePredicate({ op, value }: Check): Predicate {
  switch (op) {
    case 'eq': return actual => equal(actual, value);
    case 'neq': return actual => !equal(actual, value);
    case 'gt': return compare(value, (actual, expected) => actual > expected);
    case 'lt': return compare(value, (actual, expected) => actual < expected);
    case 'gte': return compare(value, (actual, expected) => actual >= expected);
    case 'lte': return compare(value, (actual, expected) => actual <= expected);
  }
}

export function compilePredicate(check: Check): Predicate {
  const test = makePredicate(check);
  return actual => actual !== missing && test(actual);
}
