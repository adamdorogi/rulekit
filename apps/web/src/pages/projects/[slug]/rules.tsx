import type { Ruleset } from '@rulekit/engine';
import { useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import useSWR from 'swr';
import { RequestError } from '../../../components/Feedback';
import { ProjectPage } from '../../../components/ProjectPage';
import { RuleEditor } from '../../../components/RuleEditor';
import { api, projectPath } from '../../../lib/api';
import type { Draft, Project, Session } from '../../../lib/types';


function Rules({ project, session }: { project: Project; session: Session }) {
  const base = projectPath(project.slug);
  const { data: draft, error: draftError, mutate: refreshDraft } = useSWR<Draft>(base + '/draft');
  const [edited, setEdited] = useState<Ruleset>();
  const [error, setError] = useState<unknown>();
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const ruleset = edited ?? draft?.ruleset;
  const canEdit = session.role !== 'viewer';

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

  return (
    <>
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
            <h2 className="h5 mb-0">Draft {edited && <span className="small text-secondary">(unsaved)</span>}</h2>
            {canEdit && ruleset && (
              <div className="d-flex gap-2 flex-wrap">
                <Button size="sm" variant="outline-secondary" disabled={busy || !edited} onClick={() => void save()}>Save draft</Button>
              </div>
            )}
      </div>
      <RequestError error={draftError || error} />
      {notice && <Alert variant="success" className="py-2">{notice}</Alert>}
      {ruleset ? <RuleEditor ruleset={ruleset} readOnly={!canEdit || busy} onChange={setEdited} /> : !draftError && <p>Loading draft...</p>}
    </>
  );
}

export default function RulesPage() {
  return <ProjectPage page="rules">{(project, session) => <Rules key={project.id} project={project} session={session} />}</ProjectPage>;
}
