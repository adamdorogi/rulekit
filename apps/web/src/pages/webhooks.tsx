import { useState, type FormEvent } from 'react';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Modal from 'react-bootstrap/Modal';
import Table from 'react-bootstrap/Table';
import useSWR from 'swr';
import { formatDate, RequestError } from '../components/Feedback';
import { Shell } from '../components/Shell';
import { api } from '../lib/api';

const path = '/v1/webhooks';
const events = ['evaluation.completed', 'review.created', 'review.resolved'];

interface Endpoint {
  id: string;
  url: string;
  secret: string;
  events: string[];
  createdAt: string;
}

function WebhookForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => Promise<unknown> }) {
  const [url, setUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState(events);
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);

  async function create(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    setBusy(true);
    try {
      await api<Endpoint>(path, { method: 'POST', body: { url: url.trim(), events: selectedEvents } });
      await onCreated();
      onClose();
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal show onHide={() => { if (!busy) onClose(); }}>
      <Modal.Header closeButton={!busy}><Modal.Title>Register endpoint</Modal.Title></Modal.Header>
      <Form onSubmit={(event) => void create(event)}>
        <Modal.Body>
          <RequestError error={error} />
          <Form.Group className="mb-3" controlId="webhook-url">
            <Form.Label>Endpoint URL</Form.Label>
            <Form.Control size="sm" type="url" value={url} placeholder="https://example.com/hooks/rulekit" required onChange={(event) => setUrl(event.target.value)} />
          </Form.Group>
          <fieldset>
            <legend className="h6">Events</legend>
            {events.map((type) => (
              <Form.Check id={type} key={type} label={type} checked={selectedEvents.includes(type)} onChange={(event) => {
                setSelectedEvents(event.target.checked ? [...selectedEvents, type] : selectedEvents.filter((item) => item !== type));
              }} />
            ))}
          </fieldset>
        </Modal.Body>
        <Modal.Footer>
          <Button size="sm" variant="outline-secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button size="sm" type="submit" disabled={busy || !selectedEvents.length}>Register endpoint</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

function Webhooks() {
  const { data: endpoints, error, mutate } = useSWR<Endpoint[]>(path);
  const [showCreate, setShowCreate] = useState(false);
  const [secret, setSecret] = useState<Endpoint>();
  return (
    <>
      <div className="d-flex justify-content-between align-items-center gap-2 mb-3">
        <h1 className="h4 mb-0">Webhooks</h1>
        <Button size="sm" onClick={() => setShowCreate(true)}>Register endpoint</Button>
      </div>
      <RequestError error={error} />
      <Table responsive striped bordered hover size="sm" className="bg-white small mb-4">
        <thead className="table-light"><tr><th>Endpoint URL</th><th>Events</th><th>Registered at</th><th>Signing secret</th></tr></thead>
        <tbody>
          {endpoints?.map((endpoint) => (
            <tr key={endpoint.id}>
              <td><code>{endpoint.url}</code></td>
              <td><code>{endpoint.events.join(', ')}</code></td>
              <td>{formatDate(endpoint.createdAt)}</td>
              <td><Button size="sm" variant="outline-secondary" onClick={() => setSecret(endpoint)}>Show secret</Button></td>
            </tr>
          ))}
          {endpoints?.length === 0 && <tr><td colSpan={4}>No endpoints registered.</td></tr>}
        </tbody>
      </Table>
      {showCreate && <WebhookForm onClose={() => setShowCreate(false)} onCreated={() => mutate()} />}
      {secret && (
        <Modal show onHide={() => setSecret(undefined)}>
          <Modal.Header closeButton><Modal.Title>Signing secret</Modal.Title></Modal.Header>
          <Modal.Body>
            <p className="small"><code>{secret.url}</code></p>
            <Form.Control size="sm" readOnly value={secret.secret} aria-label="HMAC secret" className="json-edit" onFocus={(event) => event.target.select()} />
          </Modal.Body>
          <Modal.Footer><Button variant="outline-secondary" size="sm" onClick={() => setSecret(undefined)}>Close</Button></Modal.Footer>
        </Modal>
      )}
    </>
  );
}

export default function WebhooksPage() {
  return <Shell title="Webhooks">{(session) => session.role === 'admin' ? <Webhooks /> : <Alert variant="warning">Workspace admin access required.</Alert>}</Shell>;
}
