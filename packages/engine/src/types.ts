export const operators = [
  'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'not_in',
  'contains', 'regex', 'exists'
] as const;

export const outcomes = ['allow', 'deny', 'review'] as const;
export const modes = ['first_match', 'all_matches'] as const;

export type Operator = typeof operators[number];
export type Outcome = typeof outcomes[number];
export type EvaluationMode = typeof modes[number];

export interface Check {
  field: string;
  op: Operator;
  value?: unknown;
}

export type Condition =
  | Check
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition };

export interface Rule {
  id: string;
  name?: string;
  when: Condition;
  outcome: Outcome;
  outputs?: Record<string, unknown>;
}

export interface Ruleset {
  mode: EvaluationMode;
  rules: Rule[];
  defaultOutcome: Outcome;
  defaultOutputs?: Record<string, unknown>;
}

export interface StepTrace {
  ruleId: string;
  field: string;
  op: Operator;
  actual: unknown;
  expected: unknown;
  passed: boolean;
  missing?: boolean;
}

export interface EvaluationResult {
  outcome: Outcome;
  outputs: Record<string, unknown>;
  matchedRuleIds: string[];
  durationUs: number;
  trace: StepTrace[];
}
