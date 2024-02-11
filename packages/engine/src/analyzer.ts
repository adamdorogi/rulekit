import { contradictoryField } from './bounds';
import { hasDuplicateCondition } from './signature';
import { Ruleset } from './types';

export interface AnalyzerIssue {
  code: 'contradictory_bounds' | 'shadowed_rule' | 'duplicate_condition' | 'overlapping_bounds';
  severity: 'error' | 'warning';
  ruleId: string;
  relatedRuleId?: string;
  field?: string;
  message: string;
}

export function analyzeRuleset(ruleset: Ruleset): AnalyzerIssue[] {
  const issues: AnalyzerIssue[] = [];
  for (const { id: ruleId, when } of ruleset.rules) {
    if (hasDuplicateCondition(when)) {
      issues.push({
        code: 'duplicate_condition', severity: 'warning', ruleId,
        message: 'Condition appears more than once in the same group.'
      });
    }
    const field = contradictoryField(when);
    if (field) {
      issues.push({
        code: 'contradictory_bounds', severity: 'error', ruleId, field,
        message: `Numeric limits on ${field} cannot all be true.`
      });
      continue;
    }
  }
  return issues;
}
