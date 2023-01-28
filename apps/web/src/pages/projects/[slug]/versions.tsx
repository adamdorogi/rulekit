import Badge from 'react-bootstrap/Badge';
import Table from 'react-bootstrap/Table';
import useSWR from 'swr';
import { formatDate, RequestError } from '../../../components/Feedback';
import { ProjectPage } from '../../../components/ProjectPage';
import { projectPath } from '../../../lib/api';
import type { Project, Version } from '../../../lib/types';

function VersionHistory({ project }: { project: Project }) {
  const base = projectPath(project.slug);
  const { data: versions, error } = useSWR<Version[]>(base + '/versions');
  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h2 className="h5 mb-0">Version history</h2>
      </div>
      <RequestError error={error} />
      <Table responsive striped bordered hover size="sm" className="bg-white small">
        <thead className="table-light"><tr><th>Version</th><th>Checksum</th><th>Release note</th><th>Published at</th></tr></thead>
        <tbody>
          {versions?.map((version) => (
            <tr key={version.id}>
              <td><code>v{version.number}</code> {version.number === project.activeVersion && <Badge bg="success">Active</Badge>}</td>
              <td><code title={version.checksum}>{version.checksum.slice(0, 12)}</code></td>
              <td>{version.note || '-'}</td>
              <td>{formatDate(version.createdAt)}</td>
            </tr>
          ))}
          {versions?.length === 0 && <tr><td colSpan={4}>No published versions.</td></tr>}
        </tbody>
      </Table>
    </>
  );
}

export default function VersionsPage() {
  return <ProjectPage page="versions">{(project) => <VersionHistory key={project.id} project={project} />}</ProjectPage>;
}
