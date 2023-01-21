import type { Ruleset } from '@rulekit/engine';
import { useState, type FormEvent } from 'react';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Modal from 'react-bootstrap/Modal';
import useSWR, { useSWRConfig } from 'swr';
import { RequestError } from '../../../components/Feedback';
import { ProjectPage } from '../../../components/ProjectPage';
import { RuleEditor } from '../../../components/RuleEditor';
import { api, projectPath, projectsPath } from '../../../lib/api';
import { summarizeChanges } from '../../../lib/diff';
import type { Draft, Project, Session, Version } from '../../../lib/types';


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
  const [modal, setModal] = useState<'publish'>();
  const [error, setError] = useState<unknown>();
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const ruleset = edited ?? draft?.ruleset;
  const canEdit = session.role !== 'viewer';
  const previous = versions?.find((version) => version.number === project.activeVersion);

  async function saveDraft() {
    if (!edited) return;
    const saved = await api<Draft>(base + '/draft', { method: 'PUT', body: { ruleset: edited } });
    await refreshDraft(saved, false);
    setEdited(undefined);
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
      await saveDraft();
      const version = await api<Version>(base + '/publish', { method: 'POST', body: { note } });
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
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
            <h2 className="h5 mb-0">Draft {edited && <span className="small text-secondary">(unsaved)</span>}</h2>
            {canEdit && ruleset && (
              <div className="d-flex gap-2 flex-wrap">
                <Button size="sm" variant="outline-secondary" disabled={busy || !edited} onClick={() => void save()}>Save draft</Button>
                <Button size="sm" disabled={busy || (!versions && project.activeVersion !== null)} onClick={() => { setError(undefined); setModal('publish'); }}>Publish Version</Button>
              </div>
            )}
      </div>
      <RequestError error={draftError || versionsError || (!modal && error)} />
      {notice && <Alert variant="success" className="py-2">{notice}</Alert>}
      {ruleset ? <RuleEditor ruleset={ruleset} readOnly={!canEdit || busy} onChange={setEdited} /> : !draftError && <p>Loading draft...</p>}
      {modal === 'publish' && ruleset && <PublishModal previous={previous?.ruleset} current={ruleset} onClose={() => setModal(undefined)} onPublish={(note) => void publish(note)} busy={busy} error={error} />}
    </>
  );
}

export default function RulesPage() {
  return <ProjectPage page="rules">{(project, session) => <Rules key={project.id} project={project} session={session} />}</ProjectPage>;
}
