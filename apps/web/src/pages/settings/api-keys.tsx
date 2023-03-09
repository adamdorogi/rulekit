import { useState, type FormEvent } from 'react';
import Alert from 'react-bootstrap/Alert';
import Badge from 'react-bootstrap/Badge';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Modal from 'react-bootstrap/Modal';
import Table from 'react-bootstrap/Table';
import useSWR from 'swr';
import { formatDate, RequestError } from '../../components/Feedback';
import { Shell } from '../../components/Shell';
import { api } from '../../lib/api';

const path = '/v1/api-keys';

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  revokedAt: string | null;
  key?: string;
}

function KeyForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => Promise<unknown> }) {
  const [name, setName] = useState('');
  const [created, setCreated] = useState<ApiKey>();
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);

  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const key = await api<ApiKey>(path, { method: 'POST', body: { name: name.trim() } });
      setCreated(key);
      await onCreated();
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal show onHide={() => { if (!busy) onClose(); }}>
      <Modal.Header closeButton={!busy}><Modal.Title>{created ? 'Copy API key' : 'New API key'}</Modal.Title></Modal.Header>
      <Form onSubmit={(event) => void create(event)}>
        <Modal.Body>
          <RequestError error={error} />
          {created ? (
            <Form.Group controlId="created-api-key">
              <Form.Label>The full key is shown once. Copy it before closing.</Form.Label>
              <Form.Control size="sm" readOnly className="json-edit" value={created.key || ''} onFocus={(event) => event.target.select()} />
            </Form.Group>
          ) : (
            <Form.Group controlId="api-key-name">
              <Form.Label>Name</Form.Label>
              <Form.Control size="sm" required value={name} onChange={(event) => setName(event.target.value)} />
            </Form.Group>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button size="sm" variant="outline-secondary" disabled={busy} onClick={onClose}>{created ? 'Done' : 'Cancel'}</Button>
          {!created && <Button size="sm" type="submit" disabled={busy || !name.trim()}>Create key</Button>}
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

function ApiKeys() {
  const { data: keys, error, mutate } = useSWR<ApiKey[]>(path);
  const [showCreate, setShowCreate] = useState(false);
  const [revoke, setRevoke] = useState<ApiKey>();
  const [revokeError, setRevokeError] = useState<unknown>();
  const [busy, setBusy] = useState(false);

  async function confirmRevoke() {
    if (!revoke) return;
    setBusy(true);
    setRevokeError(undefined);
    try {
      await api(path + '/' + encodeURIComponent(revoke.id), { method: 'DELETE' });
      await mutate();
      setRevoke(undefined);
    } catch (error) {
      setRevokeError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="d-flex justify-content-between align-items-center gap-2 mb-3">
        <h1 className="h4 mb-0">API keys</h1>
        <Button size="sm" onClick={() => setShowCreate(true)}>New API key</Button>
      </div>
      <RequestError error={error} />
      <Table responsive striped bordered hover size="sm" className="bg-white small">
        <thead className="table-light"><tr><th>Name</th><th>Prefix</th><th>Created at</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>
          {keys?.map((key) => (
            <tr key={key.id}>
              <td>{key.name}</td>
              <td><code>{key.prefix}</code></td>
              <td>{formatDate(key.createdAt)}</td>
              <td>{key.revokedAt ? <Badge bg="secondary" title={formatDate(key.revokedAt)}>Revoked</Badge> : <Badge bg="success">Active</Badge>}</td>
              <td>{!key.revokedAt && <Button size="sm" variant="outline-danger" onClick={() => { setRevokeError(undefined); setRevoke(key); }}>Revoke</Button>}</td>
            </tr>
          ))}
          {keys?.length === 0 && <tr><td colSpan={5}>No API keys.</td></tr>}
        </tbody>
      </Table>
      {showCreate && <KeyForm onClose={() => setShowCreate(false)} onCreated={() => mutate()} />}
      {revoke && (
        <Modal show onHide={() => { if (!busy) setRevoke(undefined); }}>
          <Modal.Header closeButton={!busy}><Modal.Title>Revoke API key</Modal.Title></Modal.Header>
          <Modal.Body>
            <RequestError error={revokeError} />
            Requests using <code>{revoke.prefix}</code> will fail immediately.
          </Modal.Body>
          <Modal.Footer>
            <Button size="sm" variant="outline-secondary" disabled={busy} onClick={() => setRevoke(undefined)}>Cancel</Button>
            <Button size="sm" variant="danger" disabled={busy} onClick={() => void confirmRevoke()}>Revoke key</Button>
          </Modal.Footer>
        </Modal>
      )}
    </>
  );
}

export default function ApiKeysPage() {
  return <Shell title="API keys">{(session) => session.role === 'admin' ? <ApiKeys /> : <Alert variant="warning">Workspace admin access required.</Alert>}</Shell>;
}
