import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState, type FormEvent } from 'react';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Modal from 'react-bootstrap/Modal';
import Table from 'react-bootstrap/Table';
import useSWR from 'swr';
import { formatDate, RequestError } from '../../components/Feedback';
import { Shell } from '../../components/Shell';
import { api, projectsPath } from '../../lib/api';
import type { Project, Session } from '../../lib/types';

function ProjectList({ session }: { session: Session }) {
  const router = useRouter();
  const { data: projects, error, mutate } = useSWR<Project[]>(projectsPath);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [mode, setMode] = useState<Project['mode']>('first_match');
  const [createError, setCreateError] = useState<unknown>();
  const [busy, setBusy] = useState(false);

  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setCreateError(undefined);
    try {
      const project = await api<Project>(projectsPath, { method: 'POST', body: { name, slug, mode } });
      await mutate();
      await router.push('/projects/' + encodeURIComponent(project.slug) + '/rules');
    } catch (error) {
      setCreateError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <h1 className="h4 mb-0">Projects</h1>
        {session.role !== 'viewer' && <Button size="sm" onClick={() => setShowCreate(true)}>New project</Button>}
      </div>
      <RequestError error={error} />
      <Table responsive striped bordered hover size="sm" className="bg-white small">
        <thead className="table-light">
          <tr><th>Name</th><th>Slug</th><th>Active Version</th><th>Mode</th><th>24h Evals</th><th>Last Published</th></tr>
        </thead>
        <tbody>
          {projects?.map((project) => (
            <tr key={project.id}>
              <td><Link href={'/projects/' + encodeURIComponent(project.slug) + '/rules'}>{project.name}</Link></td>
              <td><code>{project.slug}</code></td>
              <td>{project.activeVersion === null ? '-' : <code>v{project.activeVersion}</code>}</td>
              <td><code>{project.mode}</code></td>
              <td>{project.evaluations24h}</td>
              <td>{formatDate(project.lastPublished)}</td>
            </tr>
          ))}
          {projects?.length === 0 && <tr><td colSpan={6}>No projects yet.</td></tr>}
          {!error && !projects && <tr><td colSpan={6}>Loading projects...</td></tr>}
        </tbody>
      </Table>
      <Modal show={showCreate} onHide={() => setShowCreate(false)}>
        <Modal.Header closeButton><Modal.Title>New project</Modal.Title></Modal.Header>
        <Form onSubmit={(event) => void create(event)}>
          <Modal.Body>
            <RequestError error={createError} />
            <Form.Group className="mb-3" controlId="new-project-name">
              <Form.Label>Name</Form.Label>
              <Form.Control value={name} size="sm" required onChange={(event) => setName(event.target.value)} />
            </Form.Group>
            <Form.Group className="mb-3" controlId="new-project-slug">
              <Form.Label>Slug</Form.Label>
              <Form.Control value={slug} size="sm" required pattern="[a-z0-9]+(-[a-z0-9]+)*" onChange={(event) => setSlug(event.target.value)} />
            </Form.Group>
            <Form.Group controlId="new-project-mode">
              <Form.Label>Mode</Form.Label>
              <Form.Select size="sm" value={mode} onChange={(event) => setMode(event.target.value as Project['mode'])}>
                <option value="first_match">first_match</option>
                <option value="all_matches">all_matches</option>
              </Form.Select>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button size="sm" variant="outline-secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button size="sm" type="submit" disabled={busy}>Create project</Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </>
  );
}

export default function Projects() {
  return <Shell title="Projects">{(session) => <ProjectList session={session} />}</Shell>;
}
