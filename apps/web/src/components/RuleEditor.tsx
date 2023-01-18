import type { Outcome, Rule, Ruleset } from '@rulekit/engine';
import Button from 'react-bootstrap/Button';
import Card from 'react-bootstrap/Card';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import InputGroup from 'react-bootstrap/InputGroup';
import Row from 'react-bootstrap/Row';
import { ConditionEditor, JsonValueInput, newCondition } from './ConditionEditor';

const outcomes: Outcome[] = ['allow', 'deny', 'review'];

function OutcomeSelect({ value, onChange, label, readOnly, id }: { id?: string; value: Outcome; onChange: (value: Outcome) => void; label: string; readOnly: boolean }) {
  return (
    <Form.Select size="sm" value={value} id={id} aria-label={label} disabled={readOnly} onChange={(event) => onChange(event.target.value as Outcome)}>
      {outcomes.map((outcome) => <option key={outcome}>{outcome}</option>)}
    </Form.Select>
  );
}

function Outputs({ outputs = {}, onChange, readOnly }: { outputs?: Record<string, unknown>; onChange: (value: Record<string, unknown>) => void; readOnly: boolean }) {
  const entries = Object.entries(outputs);

  function add() {
    let index = 1;
    while (Object.prototype.hasOwnProperty.call(outputs, 'output_' + index)) index++;
    onChange({ ...outputs, ['output_' + index]: '' });
  }

  return (
    <>
      {entries.map(([key, value], index) => (
        <InputGroup size="sm" className="mb-1" key={key}>
          <Form.Control
            defaultValue={key}
            readOnly={readOnly}
            aria-label="Output key"
            onBlur={(event) => {
              const name = event.currentTarget.value.trim();
              if (!name || (name !== key && Object.prototype.hasOwnProperty.call(outputs, name))) {
                event.currentTarget.value = key;
                return;
              }
              if (name !== key) onChange(Object.fromEntries(entries.map((item, i) => i === index ? [name, value] : item)));
            }}
          />
          {readOnly ? (
            <Form.Control readOnly aria-label="Output value" value={JSON.stringify(value) ?? ''} />
          ) : (
            <>
              <JsonValueInput value={value} label="Output value" onChange={(next) => onChange({ ...outputs, [key]: next })} />
              <Button variant="outline-secondary" aria-label={'Remove output ' + key} onClick={() => onChange(Object.fromEntries(entries.filter(([name]) => name !== key)))}>Remove</Button>
            </>
          )}
        </InputGroup>
      ))}
      {!entries.length && <p className="small text-secondary mb-1">No outputs.</p>}
      {!readOnly && <Button variant="outline-secondary" size="sm" onClick={add}>Add output</Button>}
    </>
  );
}

export function RuleEditor({ ruleset, onChange, readOnly }: { ruleset: Ruleset; onChange: (value: Ruleset) => void; readOnly: boolean }) {
  function setRule(index: number, value: Rule) {
    onChange({ ...ruleset, rules: ruleset.rules.map((rule, i) => i === index ? value : rule) });
  }

  function move(index: number, offset: number) {
    const next = [...ruleset.rules];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    onChange({ ...ruleset, rules: next });
  }

  function add() {
    let index = ruleset.rules.length + 1;
    while (ruleset.rules.some((rule) => rule.id === 'rule-' + index)) index++;
    const rule: Rule = { id: 'rule-' + index, name: 'Rule ' + index, when: newCondition(), outcome: 'review' };
    onChange({ ...ruleset, rules: [...ruleset.rules, rule] });
  }

  return (
    <>
      <Card className="mb-3">
        <Card.Header className="bg-white fw-semibold">Ruleset defaults</Card.Header>
        <Card.Body>
          <Row className="g-3">
            <Col sm={4} lg={3}>
              <Form.Group controlId="rules-mode">
                <Form.Label className="small">Mode</Form.Label>
                <Form.Select size="sm" value={ruleset.mode} disabled={readOnly} onChange={(event) => onChange({ ...ruleset, mode: event.target.value as Ruleset['mode'] })}>
                  <option value="first_match">first_match</option>
                  <option value="all_matches">all_matches</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col sm={4} lg={3}>
              <Form.Label className="small" htmlFor="rules-default-outcome">Default outcome</Form.Label>
              <OutcomeSelect id="rules-default-outcome" value={ruleset.defaultOutcome} label="Default outcome" readOnly={readOnly} onChange={(defaultOutcome) => onChange({ ...ruleset, defaultOutcome })} />
            </Col>
            <Col sm={4} lg={6}>
              <div className="small mb-2">Default outputs</div>
              <Outputs outputs={ruleset.defaultOutputs} readOnly={readOnly} onChange={(defaultOutputs) => onChange({ ...ruleset, defaultOutputs })} />
            </Col>
          </Row>
        </Card.Body>
      </Card>
      {ruleset.rules.map((rule, index) => (
        <Card key={rule.id} className="mb-2">
          <Card.Header className="bg-white d-flex align-items-center justify-content-between gap-2 flex-wrap">
            <div className="d-flex align-items-center gap-2">
              <span className="text-secondary small">{index + 1}.</span>
              <code>{rule.id}</code>
              <Form.Control size="sm" aria-label={'Rule name ' + rule.id} value={rule.name || ''} readOnly={readOnly} onChange={(event) => setRule(index, { ...rule, name: event.target.value })} />
            </div>
            {!readOnly && (
              <div className="d-flex gap-1">
                <Button size="sm" variant="outline-secondary" disabled={index === 0} aria-label={'Move ' + rule.id + ' up'} onClick={() => move(index, -1)}>Up</Button>
                <Button size="sm" variant="outline-secondary" disabled={index === ruleset.rules.length - 1} aria-label={'Move ' + rule.id + ' down'} onClick={() => move(index, 1)}>Down</Button>
                <Button size="sm" variant="outline-secondary" aria-label={'Remove rule ' + rule.id} onClick={() => onChange({ ...ruleset, rules: ruleset.rules.filter((item) => item.id !== rule.id) })}>Remove</Button>
              </div>
            )}
          </Card.Header>
          <Card.Body>
            <div className="small text-secondary mb-1">When</div>
            <ConditionEditor condition={rule.when} readOnly={readOnly} onChange={(when) => setRule(index, { ...rule, when })} />
            <Row className="g-2 mt-1">
              <Col sm={3}>
                <div className="small text-secondary mb-1">Outcome</div>
                <OutcomeSelect value={rule.outcome} readOnly={readOnly} label={'Outcome ' + rule.id} onChange={(outcome) => setRule(index, { ...rule, outcome })} />
              </Col>
              <Col sm={9}>
                <div className="small text-secondary mb-1">Outputs</div>
                <Outputs outputs={rule.outputs} readOnly={readOnly} onChange={(outputs) => setRule(index, { ...rule, outputs })} />
              </Col>
            </Row>
          </Card.Body>
        </Card>
      ))}
      {!ruleset.rules.length && <p className="small text-secondary">No rules. The default outcome applies.</p>}
      {!readOnly && <Button size="sm" variant="outline-secondary" onClick={add}>Add rule</Button>}
    </>
  );
}
