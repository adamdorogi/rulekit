import { compilePredicate } from './operators';
import { missing, resolvePath } from './path';
import { Condition, EvaluationResult, Outcome, Ruleset, StepTrace } from './types';

type ConditionTest = (input: unknown, trace: StepTrace[]) => boolean;

const priority: Record<Outcome, number> = { allow: 0, review: 1, deny: 2 };

function compileCondition(condition: Condition, ruleId: string): ConditionTest {
  if ('all' in condition) {
    const tests = condition.all.map(child => compileCondition(child, ruleId));
    return (input, trace) => tests.every(test => test(input, trace));
  }
  if ('any' in condition) {
    const tests = condition.any.map(child => compileCondition(child, ruleId));
    return (input, trace) => tests.some(test => test(input, trace));
  }
  if ('not' in condition) {
    const test = compileCondition(condition.not, ruleId);
    return (input, trace) => !test(input, trace);
  }

  const { field, op, value } = condition;
  const expected = value === undefined ? (op === 'exists' ? true : null) : value;
  const path = field.split('.');
  const predicate = compilePredicate(condition);
  return (input, trace) => {
    const actual = resolvePath(input, path);
    const passed = predicate(actual);
    const step = { ruleId, field, op, expected, passed };
    trace.push(actual === missing
      ? { ...step, actual: null, missing: true }
      : { ...step, actual });
    return passed;
  };
}

export function compileRuleset(ruleset: Ruleset): (input: unknown) => EvaluationResult {
  const { mode, defaultOutcome, defaultOutputs } = ruleset;
  const rules = ruleset.rules.map(({ id, when, outcome, outputs }) => ({
    id, outcome, outputs, test: compileCondition(when, id)
  }));

  return input => {
    const started = performance.now();
    const trace: StepTrace[] = [];
    const matchedRuleIds: string[] = [];
    let outputs = { ...defaultOutputs };
    let outcome: Outcome | undefined;
    for (const rule of rules) {
      if (!rule.test(input, trace)) continue;
      matchedRuleIds.push(rule.id);
      outputs = { ...outputs, ...rule.outputs };
      if (!outcome || priority[rule.outcome] > priority[outcome]) outcome = rule.outcome;
      if (mode === 'first_match') break;
    }
    return {
      outcome: outcome ?? defaultOutcome,
      outputs,
      matchedRuleIds,
      durationUs: Math.round((performance.now() - started) * 1000),
      trace
    };
  };
}

export function evaluateRuleset(ruleset: Ruleset, input: unknown): EvaluationResult {
  return compileRuleset(ruleset)(input);
}
