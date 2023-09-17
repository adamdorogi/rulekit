import { z } from 'zod';
import { compileRegex } from './regex';
import { Check, Condition, modes, operators, outcomes, Rule, Ruleset } from './types';

function isJson(value: unknown): boolean {
  const pending = [{ item: value, depth: 0 }];
  while (pending.length) {
    const { item, depth } = pending.pop()!;
    if (depth > 48) return false;
    if (typeof item === 'number' && !Number.isFinite(item)) return false;
    if (item === null || ['boolean', 'string', 'number'].includes(typeof item)) continue;
    if (!item || typeof item !== 'object') return false;
    const prototype = Object.getPrototypeOf(item);
    if (prototype !== null && prototype !== Object.prototype && !Array.isArray(item)) return false;
    for (const child of Object.values(item)) pending.push({ item: child, depth: depth + 1 });
  }
  return true;
}

const json = z.unknown().refine(isJson, 'Expected a JSON value');
const outputs = z.record(json);

const checkShape = z.object({
  field: z.string().max(200).regex(/^[^.\s]+(?:\.[^.\s]+)*$/),
  op: z.enum(operators),
  value: json.optional()
}).strict();

function checkSchema(checkRegex: boolean): z.ZodType<Check> {
  return checkShape.superRefine(({ op, value }, context) => {
    let problem: string | undefined;
    switch (op) {
      case 'gt':
      case 'gte':
      case 'lt':
      case 'lte':
        if (typeof value !== 'number') problem = 'Expected a number';
        break;
      case 'in':
      case 'not_in':
        if (!Array.isArray(value)) problem = 'Expected an array';
        break;
      case 'regex':
        if (typeof value !== 'string' || (checkRegex && !compileRegex(value))) {
          problem = 'Invalid or unsupported regex';
        }
        break;
      case 'exists':
        if (value !== undefined && typeof value !== 'boolean') problem = 'Expected a boolean';
        break;
      default:
        if (value === undefined) problem = 'Expected a value';
    }
    if (problem) context.addIssue({ code: 'custom', path: ['value'], message: problem });
  });
}

const depthLimit = 12;

function conditionAt(check: z.ZodType<Check>, depth = 0): z.ZodType<Condition> {
  if (depth === depthLimit) return check;
  const child = z.lazy(() => conditionAt(check, depth + 1));
  return z.union([
    check,
    z.object({ all: z.array(child).max(50) }).strict(),
    z.object({ any: z.array(child).max(50) }).strict(),
    z.object({ not: child }).strict()
  ]);
}

export const conditionSchema = conditionAt(checkSchema(true));

function rulesetWith(condition: z.ZodType<Condition>): z.ZodType<Ruleset> {
  const rule: z.ZodType<Rule> = z.object({
    id: z.string().min(1).max(100),
    name: z.string().max(200).optional(),
    when: condition,
    outcome: z.enum(outcomes),
    outputs: outputs.optional()
  }).strict();

  return z.object({
    mode: z.enum(modes),
    defaultOutcome: z.enum(outcomes),
    defaultOutputs: outputs.optional(),
    rules: z.array(rule).max(500)
  }).strict().superRefine(({ rules }, context) => {
    const ids = new Set<string>();
    rules.forEach(({ id }, index) => {
      if (ids.has(id)) {
        context.addIssue({ code: 'custom', path: ['rules', index, 'id'], message: 'Duplicate rule ID' });
      }
      ids.add(id);
    });
  });
}

export const rulesetSchema = rulesetWith(conditionSchema);

// Old releases stay readable. Unsupported regex checks return false at runtime.
export const storedRulesetSchema = rulesetWith(conditionAt(checkSchema(false)));
