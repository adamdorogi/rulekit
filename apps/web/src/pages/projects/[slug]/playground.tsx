import type { EvaluationResult } from '@rulekit/engine';
import { useState, type FormEvent } from 'react';
import Button from 'react-bootstrap/Button';
import Card from 'react-bootstrap/Card';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import ListGroup from 'react-bootstrap/ListGroup';
import Row from 'react-bootstrap/Row';
import { JsonBlock, OutcomeBadge, RequestError } from '../../../components/Feedback';
import { ProjectPage } from '../../../components/ProjectPage';
import { api, projectPath } from '../../../lib/api';
import { projectFixtures } from '../../../lib/fixtures';
import type { Project } from '../../../lib/types';

function inlineValue(value: unknown) {
  return value === undefined ? '(missing)' : JSON.stringify(value);
}

function Playground({ project }: { project: Project }) {
  const fixtures = projectFixtures(project.slug);
  const [fixture, setFixture] = useState('0');
  const [payload, setPayload] = useState(() => JSON.stringify(fixtures[0].input, null, 2));
  const [source, setSource] = useState<'draft' | 'active'>('draft');
  const [result, setResult] = useState<EvaluationResult>();
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);

  async function run(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    setResult(undefined);
    setBusy(true);
    try {
      let input: unknown;
      try {
        input = JSON.parse(payload);
      } catch (error) {
        throw new Error('Invalid JSON: ' + (error instanceof Error ? error.message : 'Check the payload.'));
      }
      if (!input || typeof input !== 'object' || Array.isArray(input)) {
        throw new Error('The payload must be a JSON object.');
      }
      setResult(await api<EvaluationResult>(projectPath(project.slug) + '/playground', {
        method: 'POST',
        body: { input, source },
      }));
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Row className="g-3">
      <Col md={6}>
        <Card>
          <Card.Header className="bg-white fw-semibold">Test payload</Card.Header>
          <Card.Body>
            <Form onSubmit={(event) => void run(event)}>
              <Form.Group className="mb-3" controlId="playground-fixture">
                <Form.Label>Preset</Form.Label>
                <Form.Select size="sm" value={fixture} onChange={(event) => {
                  const index = Number(event.target.value);
                  setFixture(event.target.value);
                  setPayload(JSON.stringify(fixtures[index].input, null, 2));
                }}>
                  {fixtures.map((item, index) => <option key={item.label} value={index}>{item.label}</option>)}
                </Form.Select>
              </Form.Group>
              <Form.Group className="mb-3" controlId="playground-payload">
                <Form.Label>JSON payload</Form.Label>
                <Form.Control as="textarea" size="sm" rows={13} spellCheck={false} className="json-edit" value={payload} onChange={(event) => setPayload(event.target.value)} />
              </Form.Group>
              <Form.Group className="mb-3" controlId="playground-source">
                <Form.Label>Ruleset</Form.Label>
                <Form.Select size="sm" value={source} onChange={(event) => setSource(event.target.value as typeof source)}>
                  <option value="draft">Draft</option>
                  <option value="active" disabled={project.activeVersion === null}>Active version</option>
                </Form.Select>
              </Form.Group>
              <Button size="sm" type="submit" disabled={busy}>{busy ? 'Running...' : 'Run evaluation'}</Button>
            </Form>
          </Card.Body>
        </Card>
      </Col>
      <Col md={6}>
        <Card>
          <Card.Header className="bg-white fw-semibold">Execution result</Card.Header>
          <Card.Body aria-live="polite">
            <RequestError error={error} />
            {result ? (
              <>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <OutcomeBadge outcome={result.outcome} />
                  <code>{result.durationUs} us</code>
                </div>
                <p className="small mb-2">Matched rules {result.matchedRuleIds.length ? <code>{result.matchedRuleIds.join(', ')}</code> : '-'}</p>
                <JsonBlock value={result.outputs} />
                <h2 className="h6 mt-3">Condition trace</h2>
                {result.trace.length ? (
                  <ListGroup as="ol" className="small">
                    {result.trace.map((step, index) => (
                      <ListGroup.Item as="li" key={index} variant={step.passed ? 'success' : 'danger'}>
                        <div><strong>{step.passed ? 'PASS' : 'FAIL'}</strong> <code>{step.ruleId}</code></div>
                        <div className="trace-values"><code>{step.field} {step.op} {inlineValue(step.expected)}</code> / actual <code>{inlineValue(step.actual)}</code></div>
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                ) : <p className="small text-secondary mb-0">No condition checks.</p>}
              </>
            ) : !error ? <p className="small text-secondary mb-0">Run an evaluation to see its outcome and trace.</p> : null}
          </Card.Body>
        </Card>
      </Col>
    </Row>
  );
}

export default function PlaygroundPage() {
  return <ProjectPage page="playground">{(project) => <Playground key={project.id} project={project} />}</ProjectPage>;
}
