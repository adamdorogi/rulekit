import { useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Badge from 'react-bootstrap/Badge';
import Button from 'react-bootstrap/Button';
import Card from 'react-bootstrap/Card';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Modal from 'react-bootstrap/Modal';
import Row from 'react-bootstrap/Row';
import Table from 'react-bootstrap/Table';
import useSWR, { useSWRConfig } from 'swr';
import { formatDate, JsonBlock, RequestError } from '../../../components/Feedback';
import { ProjectPage } from '../../../components/ProjectPage';
import { api, projectPath, projectsPath } from '../../../lib/api';
import { summarizeChanges } from '../../../lib/diff';
import type { Project, Session, Version } from '../../../lib/types';

function VersionHistory({ project, session }: { project: Project; session: Session }) {
  const base = projectPath(project.slug);
  const { mutate: refresh } = useSWRConfig();
  const { data: versions, error } = useSWR<Version[]>(base + '/versions');
  const [leftNumber, setLeftNumber] = useState<number>();
  const [rightNumber, setRightNumber] = useState<number>();
  const [rollback, setRollback] = useState<Version>();
  const [actionError, setActionError] = useState<unknown>();
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const active = versions?.find((version) => version.number === project.activeVersion);
  const right = versions?.find((version) => version.number === rightNumber) ?? active ?? versions?.[0];
  const left = versions?.find((version) => version.number === leftNumber) ??
    versions?.find((version) => right && version.number === right.number - 1) ?? right;
  const summary = right && left ? summarizeChanges(left.ruleset, right.ruleset) : undefined;

  async function confirmRollback() {
    if (!rollback) return;
    setBusy(true);
    setActionError(undefined);
    setNotice('');
    try {
      await api(base + '/versions/' + rollback.number + '/rollback', { method: 'POST' });
      setNotice('Active version is now v' + rollback.number + '.');
      setRollback(undefined);
      await Promise.all([refresh(base), refresh(projectsPath)]);
    } catch (error) {
      setActionError(error);
    } finally {
      setBusy(false);
    }
  }

  function compare(version: Version) {
    setLeftNumber(active?.number);
    setRightNumber(version.number);
  }

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h2 className="h5 mb-0">Version history</h2>
        <div className="d-flex gap-2">
          <a className="btn btn-sm btn-outline-secondary" href={'/api' + base + '/evaluations?format=json'} download>Export logs JSON</a>
          <a className="btn btn-sm btn-outline-secondary" href={'/api' + base + '/evaluations?format=csv'} download>Export logs CSV</a>
        </div>
      </div>
      <RequestError error={error} />
      {notice && <Alert variant="success" className="py-2">{notice}</Alert>}
      <Table responsive striped bordered hover size="sm" className="bg-white small">
        <thead className="table-light"><tr><th>Version</th><th>Checksum</th><th>Release note</th><th>Published at</th><th>Actions</th></tr></thead>
        <tbody>
          {versions?.map((version) => (
            <tr key={version.id}>
              <td><code>v{version.number}</code> {version.number === project.activeVersion && <Badge bg="success">Active</Badge>}</td>
              <td><code title={version.checksum}>{version.checksum.slice(0, 12)}</code></td>
              <td>{version.note || '-'}</td>
              <td>{formatDate(version.createdAt)}</td>
              <td className="d-flex gap-1">
                <Button size="sm" variant="outline-secondary" onClick={() => compare(version)}>Compare</Button>
                {session.role !== 'viewer' && version.number !== project.activeVersion && <Button size="sm" variant="outline-secondary" onClick={() => { setActionError(undefined); setRollback(version); }}>Rollback</Button>}
              </td>
            </tr>
          ))}
          {versions?.length === 0 && <tr><td colSpan={5}>No published versions.</td></tr>}
        </tbody>
      </Table>
      {right && left && (
        <Card>
          <Card.Header className="bg-white fw-semibold">JSON diff</Card.Header>
          <Card.Body>
            {summary && <p className="small">
              <strong>{summary.added.length}</strong> added / <strong>{summary.edited.length}</strong> edited / <strong>{summary.removed.length}</strong> removed
              {summary.reordered ? ' / rule order changed' : ''}{summary.defaultsChanged ? ' / defaults changed' : ''}
            </p>}
            <Row className="g-3">
              <Col md={6}>
                <Form.Group controlId="diff-left" className="mb-2">
                  <Form.Label className="small">Base version</Form.Label>
                  <Form.Select size="sm" value={left.number} onChange={(event) => setLeftNumber(Number(event.target.value))}>
                    {versions?.map((version) => <option key={version.id} value={version.number}>v{version.number}</option>)}
                  </Form.Select>
                </Form.Group>
                <JsonBlock value={left.ruleset} />
              </Col>
              <Col md={6}>
                <Form.Group controlId="diff-right" className="mb-2">
                  <Form.Label className="small">Compare version</Form.Label>
                  <Form.Select size="sm" value={right.number} onChange={(event) => setRightNumber(Number(event.target.value))}>
                    {versions?.map((version) => <option key={version.id} value={version.number}>v{version.number}</option>)}
                  </Form.Select>
                </Form.Group>
                <JsonBlock value={right.ruleset} />
              </Col>
            </Row>
          </Card.Body>
        </Card>
      )}
      {rollback && (
        <Modal show onHide={() => { if (!busy) setRollback(undefined); }}>
          <Modal.Header closeButton={!busy}><Modal.Title>Rollback to v{rollback.number}</Modal.Title></Modal.Header>
          <Modal.Body>
            <RequestError error={actionError} />
            Evaluations will use v{rollback.number} after rollback.
          </Modal.Body>
          <Modal.Footer>
            <Button size="sm" variant="outline-secondary" disabled={busy} onClick={() => setRollback(undefined)}>Cancel</Button>
            <Button size="sm" disabled={busy} onClick={() => void confirmRollback()}>Rollback</Button>
          </Modal.Footer>
        </Modal>
      )}
    </>
  );
}

export default function VersionsPage() {
  return <ProjectPage page="versions">{(project, session) => <VersionHistory key={project.id} project={project} session={session} />}</ProjectPage>;
}
