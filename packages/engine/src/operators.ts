import { equal } from './equality';
import { missing } from './path';
import { Check } from './types';

type Predicate = (actual: unknown) => boolean;
function makePredicate({ op, value }: Check): Predicate {
  switch (op) {
    case 'eq': return actual => equal(actual, value);
    case 'neq': return actual => !equal(actual, value);
  }
}

export function compilePredicate(check: Check): Predicate {
  const test = makePredicate(check);
  return actual => actual !== missing && test(actual);
}
