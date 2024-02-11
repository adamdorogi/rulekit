import { Condition } from './types';

function stableJson(value: unknown): unknown {
  if (Array.isArray(value)) return ['array', value.map(stableJson)];
  if (value !== null && typeof value === 'object') {
    return ['object', Object.keys(value).sort().map(key =>
      [key, stableJson((value as Record<string, unknown>)[key])])];
  }
  return value;
}

function shape(condition: Condition): unknown[] {
  if ('all' in condition) return ['all', orderedChildren(condition.all)];
  if ('any' in condition) return ['any', orderedChildren(condition.any)];
  if ('not' in condition) return ['not', shape(condition.not)];
  const { field, op, value } = condition;
  const expected = op === 'exists' ? value !== false : value;
  return ['check', field, op, stableJson(expected)];
}

function orderedChildren(children: Condition[]): unknown[][] {
  const keyed = children.map(child => {
    const tree = shape(child);
    return { tree, key: JSON.stringify(tree) };
  });
  keyed.sort((left, right) => left.key < right.key ? -1 : left.key > right.key ? 1 : 0);
  return keyed.map(({ tree }) => tree);
}

export function conditionSignature(condition: Condition): string {
  return JSON.stringify(shape(condition));
}

export function hasDuplicateCondition(condition: Condition): boolean {
  if ('not' in condition) return hasDuplicateCondition(condition.not);
  const children = 'all' in condition ? condition.all : 'any' in condition ? condition.any : [];
  const signatures = new Set(children.map(conditionSignature));
  return signatures.size < children.length || children.some(hasDuplicateCondition);
}
