import { compilePredicate } from './operators';
import { resolvePath } from './path';
import { Condition, EvaluationResult, Outcome, Ruleset } from './types';

type ConditionTest = (input: unknown) => boolean;

const priority: Record<Outcome, number> = { allow: 0, review: 1, deny: 2 };

function compileCondition(condition: Condition, ruleId: string): ConditionTest {
  if ('all' in condition) {
    const tests = condition.all.map(child => compileCondition(child, ruleId));
    return (input) => tests.every(test => test(input));
  }
  if ('any' in condition) {
    const tests = condition.any.map(child => compileCondition(child, ruleId));
    return (input) => tests.some(test => test(input));
  }
  if ('not' in condition) {
    const test = compileCondition(condition.not, ruleId);
    return (input) => !test(input);
  }

  const path = condition.field.split('.');
  const predicate = compilePredicate(condition);
  return input => predicate(resolvePath(input, path));
}

export function compileRuleset(ruleset: Ruleset): (input: unknown) => EvaluationResult {
  const { mode, defaultOutcome, defaultOutputs } = ruleset;
  const rules = ruleset.rules.map(({ id, when, outcome, outputs }) => ({
    id, outcome, outputs, test: compileCondition(when, id)
  }));

  return input => {
    const started = performance.now();
    const matchedRuleIds: string[] = [];
    let outputs = { ...defaultOutputs };
    let outcome: Outcome | undefined;
    for (const rule of rules) {
      if (!rule.test(input)) continue;
      matchedRuleIds.push(rule.id);
      outputs = { ...outputs, ...rule.outputs };
      if (!outcome || priority[rule.outcome] > priority[outcome]) outcome = rule.outcome;
      if (mode === 'first_match') break;
    }
    return {
      outcome: outcome ?? defaultOutcome,
      outputs,
      matchedRuleIds,
      durationUs: Math.round((performance.now() - started) * 1000)
    };
  };
}

export function evaluateRuleset(ruleset: Ruleset, input: unknown): EvaluationResult {
  return compileRuleset(ruleset)(input);
}
