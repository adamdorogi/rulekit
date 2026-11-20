import type { Ruleset } from '@rulekit/engine';
import dynamic from 'next/dynamic';
import { useState, type FormEvent } from 'react';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Modal from 'react-bootstrap/Modal';
import Nav from 'react-bootstrap/Nav';
import useSWR, { useSWRConfig } from 'swr';
import { RequestError } from '../../../components/Feedback';
import { DraftIssues, ImportPolicy } from '../../../components/ImportPolicy';
import { ProjectPage } from '../../../components/ProjectPage';
import { RuleEditor } from '../../../components/RuleEditor';
import { api, projectPath, projectsPath } from '../../../lib/api';
import { summarizeChanges } from '../../../lib/diff';
import type { Draft, Project, Session, Version } from '../../../lib/types';

const FlowView = dynamic(() => import('../../../components/FlowView'), { ssr: false });

function PublishModal({ previous, current, onClose, onPublish, busy, error }: {
  previous?: Ruleset;
  current: Ruleset;
  onClose: () => void;
  onPublish: (note: string) => void;
  busy: boolean;
  error: unknown;
}) {
  const [note, setNote] = useState('');
  const diff = summarizeChanges(previous, current);

  function submit(event: FormEvent) {
    event.preventDefault();
    onPublish(note.trim());
  }

  return (
    <Modal show onHide={() => { if (!busy) onClose(); }}>
      <Modal.Header closeButton={!busy}><Modal.Title>Publish Version</Modal.Title></Modal.Header>
      <Form onSubmit={submit}>
        <Modal.Body>
          <RequestError error={error} />
          <ul className="small">
            <li>Added {diff.added.length ? <code>{diff.added.join(', ')}</code> : '-'}</li>
            <li>Edited {diff.edited.length ? <code>{diff.edited.join(', ')}</code> : '-'}</li>
            <li>Removed {diff.removed.length ? <code>{diff.removed.join(', ')}</code> : '-'}</li>
            {diff.reordered && <li>Rule order changed</li>}
            {diff.defaultsChanged && <li>Ruleset defaults changed</li>}
          </ul>
          <Form.Group controlId="release-note">
            <Form.Label>Release note</Form.Label>
            <Form.Control size="sm" value={note} onChange={(event) => setNote(event.target.value)} />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button size="sm" variant="outline-secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" size="sm" disabled={busy}>{busy ? 'Publishing...' : 'Publish'}</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

function Rules({ project, session }: { project: Project; session: Session }) {
  const base = projectPath(project.slug);
  const { mutate: refresh } = useSWRConfig();
  const { data: draft, error: draftError, mutate: refreshDraft } = useSWR<Draft>(base + '/draft');
  const { data: versions, error: versionsError } = useSWR<Version[]>(base + '/versions');
  const [edited, setEdited] = useState<Ruleset>();
  const [tab, setTab] = useState('table');
  const [modal, setModal] = useState<'publish' | 'import'>();
  const [error, setError] = useState<unknown>();
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const ruleset = edited ?? draft?.ruleset;
  const canEdit = session.role !== 'viewer';
  const previous = versions?.find((version) => version.number === project.activeVersion);

  async function saveDraft() {
    if (!edited) return draft;
    const saved = await api<Draft>(base + '/draft', { method: 'PUT', body: { ruleset: edited } });
    await refreshDraft(saved, false);
    setEdited(undefined);
    return saved;
  }

  async function save() {
    setBusy(true);
    setNotice('');
    setError(undefined);
    try {
      await saveDraft();
      setNotice('Draft saved.');
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  }

  async function publish(note: string) {
    setBusy(true);
    setError(undefined);
    setNotice('');
    try {
      const saved = await saveDraft();
      if (!saved) return;
      const version = await api<Version>(base + '/publish', { method: 'POST', body: { note, expectedChecksum: saved.checksum } });
      setModal(undefined);
      setNotice('Published v' + version.number + '.');
      await Promise.all([refresh(base), refresh(base + '/versions'), refresh(projectsPath)]);
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Nav variant="pills" className="mb-3 small gap-1" activeKey={tab} onSelect={(key) => { if (key) setTab(key); }} aria-label="Rules views">
        <Nav.Item><Nav.Link as="button" eventKey="table" className="py-1 px-2">Rules table</Nav.Link></Nav.Item>
        <Nav.Item><Nav.Link as="button" eventKey="flow" className="py-1 px-2">Flow view</Nav.Link></Nav.Item>
      </Nav>
      {tab === 'flow' ? <FlowView version={project.activeVersion} /> : (
        <>
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
            <h2 className="h5 mb-0">Draft {edited && <span className="small text-secondary">(unsaved)</span>}</h2>
            {canEdit && ruleset && (
              <div className="d-flex gap-2 flex-wrap">
                <Button size="sm" variant="outline-secondary" disabled={busy || Boolean(edited)} onClick={() => setModal('import')}>Import Policy PDF</Button>
                <Button size="sm" variant="outline-secondary" disabled={busy || !edited} onClick={() => void save()}>Save draft</Button>
                <Button size="sm" disabled={busy || (!versions && project.activeVersion !== null)} onClick={() => { setError(undefined); setModal('publish'); }}>Publish Version</Button>
              </div>
            )}
          </div>
          <RequestError error={draftError || versionsError || (!modal && error)} />
          {notice && <Alert variant="success" className="py-2">{notice}</Alert>}
          {draft && <DraftIssues issues={draft.issues} />}
          {draft?.sourceText && <details className="mb-3"><summary className="small">Imported source text</summary><pre className="json-display bg-light border small p-2 mt-2">{draft.sourceText}</pre></details>}
          {ruleset ? <RuleEditor ruleset={ruleset} readOnly={!canEdit || busy} onChange={setEdited} /> : !draftError && <p>Loading draft...</p>}
        </>
      )}
      {modal === 'publish' && ruleset && <PublishModal previous={previous?.ruleset} current={ruleset} onClose={() => setModal(undefined)} onPublish={(note) => void publish(note)} busy={busy} error={error} />}
      {modal === 'import' && <ImportPolicy projectId={project.id} slug={project.slug} onClose={() => setModal(undefined)} onLoad={(imported) => {
        setEdited(undefined);
        setModal(undefined);
        setNotice('Imported rules saved to draft.');
        void refreshDraft(imported, false);
      }} />}
    </>
  );
}

export default function RulesPage() {
  return <ProjectPage page="rules">{(project, session) => <Rules key={project.id} project={project} session={session} />}</ProjectPage>;
}
