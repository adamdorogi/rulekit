import Link from 'next/link';
import Table from 'react-bootstrap/Table';
import useSWR from 'swr';
import { formatDate, RequestError } from '../../components/Feedback';
import { Shell } from '../../components/Shell';
import { projectsPath } from '../../lib/api';
import type { Project } from '../../lib/types';

function ProjectList() {
  const { data: projects, error } = useSWR<Project[]>(projectsPath);
  return (
    <>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <h1 className="h4 mb-0">Projects</h1>
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
    </>
  );
}

export default function Projects() {
  return <Shell title="Projects"><ProjectList /></Shell>;
}
