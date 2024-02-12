import {
  Bounds, boundsFor, conjunctionBounds, contradictoryField, covers, intersect, isEmpty, terms
} from './bounds';
import { conditionSignature, hasDuplicateCondition } from './signature';
import { Condition, Ruleset } from './types';

export interface AnalyzerIssue {
  code: 'contradictory_bounds' | 'shadowed_rule' | 'duplicate_condition' | 'overlapping_bounds';
  severity: 'error' | 'warning';
  ruleId: string;
  relatedRuleId?: string;
  field?: string;
  message: string;
}

interface ConstraintSet {
  signature: string;
  terms: { signature: string; field?: string; bounds?: Bounds }[];
  termSignatures: Set<string>;
  byField: Map<string, Bounds>;
}

function constraints(condition: Condition): ConstraintSet {
  const conditions = terms(condition);
  const checks = conditions.map(check => ({
    signature: conditionSignature(check),
    field: 'field' in check ? check.field : undefined,
    bounds: boundsFor(check)
  }));
  return {
    signature: conditionSignature(condition),
    terms: checks,
    termSignatures: new Set(checks.map(check => check.signature)),
    byField: conjunctionBounds(conditions)
  };
}

function shadows(earlier: ConstraintSet, later: ConstraintSet): boolean {
  if (earlier.signature === later.signature) return true;
  return earlier.terms.every(({ signature, field, bounds }) => {
    if (later.termSignatures.has(signature)) return true;
    const current = field === undefined ? undefined : later.byField.get(field);
    return bounds !== undefined && current !== undefined && covers(bounds, current);
  });
}

function overlaps(left: ConstraintSet, right: ConstraintSet): string | undefined {
  if (!left.terms.every(check => check.bounds) || !right.terms.every(check => check.bounds)) return;
  let commonField: string | undefined;
  for (const [field, bounds] of left.byField) {
    const other = right.byField.get(field);
    if (!other) continue;
    if (isEmpty(intersect(bounds, other))) return;
    commonField ??= field;
  }
  return commonField;
}

export function analyzeRuleset(ruleset: Ruleset): AnalyzerIssue[] {
  const issues: AnalyzerIssue[] = [];
  const earlier: { id: string; checks: ConstraintSet }[] = [];

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
    if (ruleset.mode !== 'first_match') continue;

    const checks = constraints(when);
    const shadow = earlier.find(rule => shadows(rule.checks, checks));
    if (shadow) {
      issues.push({
        code: 'shadowed_rule', severity: 'error', ruleId, relatedRuleId: shadow.id,
        message: `Earlier rule ${shadow.id} matches every input that matches this rule.`
      });
      continue;
    }
    for (const previous of earlier) {
      const overlap = overlaps(previous.checks, checks);
      if (overlap) {
        issues.push({
          code: 'overlapping_bounds', severity: 'warning', ruleId,
          relatedRuleId: previous.id, field: overlap,
          message: `Numeric limits on ${overlap} overlap with rule ${previous.id}.`
        });
        break;
      }
    }
    earlier.push({ id: ruleId, checks });
  }

  return issues;
}
