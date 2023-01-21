import type { Ruleset } from '@rulekit/engine';

function canonicalJson(value: unknown) {
  return JSON.stringify(value, (_key, item: unknown) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
    return Object.fromEntries(Object.entries(item).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0));
  });
}

export function summarizeChanges(previous: Ruleset | undefined, current: Ruleset) {
  const previousRules = new Map(previous?.rules.map((rule) => [rule.id, rule]));
  const currentIds = new Set(current.rules.map((rule) => rule.id));
  const added = current.rules.filter((rule) => !previousRules.has(rule.id)).map((rule) => rule.id);
  const removed = [...previousRules.keys()].filter((id) => !currentIds.has(id));
  const edited = current.rules.filter((rule) => (
    previousRules.has(rule.id) && canonicalJson(previousRules.get(rule.id)) !== canonicalJson(rule)
  )).map((rule) => rule.id);
  const previousOrder = previous?.rules.filter((rule) => currentIds.has(rule.id)).map((rule) => rule.id);
  const currentOrder = current.rules.filter((rule) => previousRules.has(rule.id)).map((rule) => rule.id);
  const reordered = previousOrder?.some((id, index) => id !== currentOrder[index]) ?? false;
  const defaultsChanged = previous?.mode !== current.mode || previous?.defaultOutcome !== current.defaultOutcome ||
    canonicalJson(previous?.defaultOutputs ?? {}) !== canonicalJson(current.defaultOutputs ?? {});

  return { added, removed, edited, reordered, defaultsChanged };
}
