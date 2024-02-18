import { Rule, Ruleset, rulesetSchema } from '@rulekit/engine'

export const fixtureText = [
  'field | operator | value | outcome',
  'applicant.age | < | 25 | review',
  'vehicle.value_aud | > | 85000 | review',
  'history.at_fault_claims | >= | 2 | deny',
].join('\n')

const operatorMap = {
  '<': 'lt', '<=': 'lte', '>': 'gt', '>=': 'gte', '=': 'eq', '==': 'eq', '!=': 'neq',
  lt: 'lt', lte: 'lte', gt: 'gt', gte: 'gte', eq: 'eq', neq: 'neq',
  in: 'in', not_in: 'not_in', contains: 'contains', regex: 'regex', exists: 'exists',
} as const

const fieldPattern = '[a-zA-Z_][a-zA-Z0-9_.]*'
const inline = new RegExp(`^\\s*(?:if\\s+)?(${fieldPattern})\\s*(<=|>=|==|!=|<|>|=|\\b(?:lt|lte|gt|gte|eq|neq|in|not_in|contains|regex|exists)\\b)\\s*(.*?)\\s*(?:->|=>|then)\\s*(allow|deny|review)\\s*$`, 'i')
const columns = new RegExp(`^${fieldPattern}$`)

function partsOf(line: string): string[] {
  if (line.includes('|')) return line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim())
  if (line.includes('\t')) return line.split('\t').map((cell) => cell.trim())
  if (line.includes(',')) {
    return (line.match(/(?:^|,)(?:"(?:[^"]|"")*"|[^,]*)/g) || [])
      .map((cell) => cell.replace(/^,/, '').trim().replace(/^"|"$/g, '').replace(/""/g, '"'))
  }
  return line.trim().split(/\s{2,}/)
}

function candidate(line: string, lineNumber: number, index: number): Rule | undefined {
  const cells = inline.exec(line)?.slice(1) || partsOf(line)
  if (cells.length < 4 || !columns.test(cells[0])) return undefined
  const [field, rawOp, rawValue, rawOutcome, rawOutputs] = cells
  const op = operatorMap[rawOp.toLowerCase() as keyof typeof operatorMap]
  const outcome = rawOutcome.toLowerCase()
  if (!op || (outcome !== 'allow' && outcome !== 'deny' && outcome !== 'review')) return undefined
  let value: unknown = rawValue
  let outputs: Record<string, unknown> | undefined
  try {
    if (/^\$?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(rawValue) || /^\$\d+(?:\.\d+)?$/.test(rawValue)) {
      value = Number(rawValue.replace(/[$,]/g, ''))
    } else if (rawValue) {
      try { value = JSON.parse(rawValue) } catch { value = rawValue }
    }
    if (rawOutputs) outputs = JSON.parse(rawOutputs) as Record<string, unknown>
  } catch {
    return undefined
  }
  const rule = {
    id: `import-${index}`,
    name: `Policy line ${lineNumber}`,
    when: { field, op, ...(rawValue || op !== 'exists' ? { value } : {}) },
    outcome,
    outputs,
  }
  const validated = rulesetSchema.safeParse({ mode: 'first_match', defaultOutcome: 'review', rules: [rule] })
  return validated.success ? validated.data.rules[0] : undefined
}

export function extractRows(text: string): Ruleset {
  const rules: Rule[] = []
  for (const [index, row] of text.split(/\r?\n/).entries()) {
    const rule = candidate(row, index + 1, rules.length + 1)
    if (rule) rules.push(rule)
    if (rules.length === 100) break
  }
  return { mode: 'first_match', defaultOutcome: 'review', rules }
}
