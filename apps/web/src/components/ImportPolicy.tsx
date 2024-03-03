import { useState, type FormEvent } from 'react';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Modal from 'react-bootstrap/Modal';
import Table from 'react-bootstrap/Table';
import { api, projectPath } from '../lib/api';
import type { Draft, DraftIssue } from '../lib/types';
import { OutcomeBadge, RequestError } from './Feedback';

type Source = { pdfBase64: string } | { text: string };

function dataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('Could not read the PDF.'));
    reader.readAsDataURL(file);
  });
}

export function DraftIssues({ issues }: { issues: DraftIssue[] }) {
  if (!issues.length) return null;
  return (
    <Alert variant="warning">
      <strong>Rule analyzer</strong>
      <ul className="mb-0 mt-1">
        {issues.map((issue, index) => <li key={index}><code>{issue.ruleId}</code> {issue.message}</li>)}
      </ul>
    </Alert>
  );
}

export function ImportPolicy({ projectId, slug, onLoad, onClose }: { projectId: string; slug: string; onLoad: (draft: Draft) => void; onClose: () => void }) {
  const endpoint = '/v1/projects/' + encodeURIComponent(projectId) + '/import-pdf';
  const [file, setFile] = useState<File>();
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<Draft>();
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);

  async function extract(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      let source: Source;
      if (file) {
        if (file.size > 5 * 1024 * 1024) throw new Error('Choose a PDF up to 5 MiB.');
        source = { pdfBase64: await dataUrl(file) };
      }
      else if (text.trim()) source = { text: text.trim() };
      else throw new Error('Choose a PDF or paste a text table.');
      const result = await api<Draft>(endpoint, { method: 'POST', body: { ...source, preview: true } });
      setPreview(result);
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  }

  async function load() {
    if (!preview) return;
    setBusy(true);
    setError(undefined);
    try {
      const result = await api<Draft>(projectPath(slug) + '/draft', {
        method: 'PUT',
        body: { ruleset: preview.ruleset, sourceText: preview.sourceText },
      });
      onLoad(result);
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal size="lg" show onHide={() => { if (!busy) onClose(); }}>
      <Modal.Header closeButton={!busy}><Modal.Title>Import Policy PDF</Modal.Title></Modal.Header>
      <Form onSubmit={(event) => void extract(event)}>
        <Modal.Body>
          <RequestError error={error} />
          <Form.Group className="mb-3" controlId="policy-pdf">
            <Form.Label>Policy PDF</Form.Label>
            <Form.Control type="file" size="sm" accept=".pdf,application/pdf" disabled={busy} onChange={(event) => {
              setFile((event.currentTarget as HTMLInputElement).files?.[0]);
              setPreview(undefined);
            }} />
          </Form.Group>
          <Form.Group className="mb-3" controlId="policy-table">
            <Form.Label>Or paste a text table</Form.Label>
            <Form.Control as="textarea" size="sm" rows={5} className="json-edit" disabled={Boolean(file) || busy} value={text} onChange={(event) => {
              setText(event.target.value);
              setPreview(undefined);
            }} />
          </Form.Group>
          {preview && (
            <>
              <DraftIssues issues={preview.issues} />
              <h2 className="h6">Candidate rules</h2>
              <Table responsive striped bordered size="sm" className="small">
                <thead><tr><th>Rule</th><th>Condition</th><th>Outcome</th></tr></thead>
                <tbody>
                  {preview.ruleset.rules.map((rule) => <tr key={rule.id}><td>{rule.name || rule.id}</td><td><code>{JSON.stringify(rule.when)}</code></td><td><OutcomeBadge outcome={rule.outcome} /></td></tr>)}
                  {!preview.ruleset.rules.length && <tr><td colSpan={3}>No candidate rules found.</td></tr>}
                </tbody>
              </Table>
              {preview.sourceText && <details><summary className="small mb-2">Source text</summary><pre className="json-display bg-light border p-2 small">{preview.sourceText}</pre></details>}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button size="sm" variant="outline-secondary" disabled={busy} onClick={onClose}>Cancel</Button>
          {preview ? (
            <Button size="sm" disabled={busy || preview.ruleset.rules.length === 0} onClick={() => void load()}>Load into Draft</Button>
          ) : <Button size="sm" type="submit" disabled={busy}>{busy ? 'Extracting...' : 'Extract rules'}</Button>}
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
