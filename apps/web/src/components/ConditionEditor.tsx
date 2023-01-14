import type { Condition, Operator } from '@rulekit/engine';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import InputGroup from 'react-bootstrap/InputGroup';

const operators: Operator[] = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'not_in', 'contains', 'regex', 'exists'];

export const newCondition = (): Condition => ({ field: '', op: 'eq', value: '' });

export function parseValue(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function JsonValueInput({ value, onChange, label }: { value: unknown; onChange: (value: unknown) => void; label: string }) {
  const defaultValue = JSON.stringify(value) ?? '';
  return (
    <Form.Control
      key={defaultValue}
      className="json-edit"
      aria-label={label}
      defaultValue={defaultValue}
      onBlur={(event) => {
        if (event.currentTarget.value !== defaultValue) onChange(parseValue(event.currentTarget.value));
      }}
    />
  );
}

interface Props {
  condition: Condition;
  onChange: (condition: Condition) => void;
  onRemove?: () => void;
  readOnly: boolean;
}

export function ConditionEditor({ condition, onChange, onRemove, readOnly }: Props) {
  return (
    <div className="mb-2">
      <InputGroup size="sm" className="mb-1">
        {'field' in condition && (
          <>
            <Form.Control value={condition.field} placeholder="applicant.age" aria-label="Field path" readOnly={readOnly} onChange={(event) => onChange({ ...condition, field: event.target.value })} />
            <Form.Select value={condition.op} aria-label="Operator" disabled={readOnly} onChange={(event) => {
              const op = event.target.value as Operator;
              onChange({ ...condition, op, value: op === 'exists' ? true : condition.op === 'exists' ? '' : condition.value });
            }}>
              {operators.map((operator) => <option key={operator}>{operator}</option>)}
            </Form.Select>
            {condition.op === 'exists' ? (
              <Form.Select aria-label="Presence" value={condition.value === false ? 'false' : 'true'} disabled={readOnly} onChange={(event) => onChange({ ...condition, value: event.target.value === 'true' })}>
                <option value="true">Present</option><option value="false">Absent</option>
              </Form.Select>
            ) : readOnly ? (
              <Form.Control readOnly aria-label="Expected value" value={JSON.stringify(condition.value) ?? ''} />
            ) : <JsonValueInput label="Expected value" value={condition.value} onChange={(value) => onChange({ ...condition, value })} />}
          </>
        )}
        {onRemove && !readOnly && <Button variant="outline-secondary" aria-label="Remove condition" onClick={onRemove}>Remove</Button>}
      </InputGroup>
    </div>
  );
}
