import { Condition } from './types';

export interface Bounds {
  min: number;
  max: number;
  minInclusive: boolean;
  maxInclusive: boolean;
}

const unbounded: Bounds = {
  min: -Infinity, max: Infinity, minInclusive: true, maxInclusive: true
};

export function boundsFor(condition: Condition): Bounds | undefined {
  if (!('field' in condition) || typeof condition.value !== 'number') return;
  const { op, value } = condition;
  switch (op) {
    case 'eq': return { ...unbounded, min: value, max: value };
    case 'gt': return { ...unbounded, min: value, minInclusive: false };
    case 'gte': return { ...unbounded, min: value };
    case 'lt': return { ...unbounded, max: value, maxInclusive: false };
    case 'lte': return { ...unbounded, max: value };
  }
}

export function intersect(left: Bounds, right: Bounds): Bounds {
  return {
    min: Math.max(left.min, right.min),
    max: Math.min(left.max, right.max),
    minInclusive: left.min === right.min
      ? left.minInclusive && right.minInclusive
      : left.min > right.min ? left.minInclusive : right.minInclusive,
    maxInclusive: left.max === right.max
      ? left.maxInclusive && right.maxInclusive
      : left.max < right.max ? left.maxInclusive : right.maxInclusive
  };
}

export function isEmpty(bounds: Bounds): boolean {
  return bounds.min > bounds.max ||
    (bounds.min === bounds.max && (!bounds.minInclusive || !bounds.maxInclusive));
}

export function covers(wider: Bounds, narrower: Bounds): boolean {
  const intersection = intersect(wider, narrower);
  return intersection.min === narrower.min && intersection.max === narrower.max &&
    intersection.minInclusive === narrower.minInclusive &&
    intersection.maxInclusive === narrower.maxInclusive;
}

export function terms(condition: Condition): Condition[] {
  return 'all' in condition ? condition.all.flatMap(terms) : [condition];
}

export function conjunctionBounds(conditions: Condition[]): Map<string, Bounds> {
  const byField = new Map<string, Bounds>();
  for (const condition of conditions) {
    if (!('field' in condition)) continue;
    const bounds = boundsFor(condition);
    if (!bounds) continue;
    const existing = byField.get(condition.field);
    byField.set(condition.field, existing ? intersect(existing, bounds) : bounds);
  }
  return byField;
}

export function contradictoryField(condition: Condition): string | undefined {
  if ('all' in condition) {
    for (const [field, bounds] of conjunctionBounds(terms(condition))) {
      if (isEmpty(bounds)) return field;
    }
    for (const child of condition.all) {
      const conflict = contradictoryField(child);
      if (conflict) return conflict;
    }
  }
  if ('any' in condition && condition.any.length) {
    const conflicts = condition.any.map(contradictoryField);
    if (conflicts.every(Boolean)) return conflicts[0];
  }
}
