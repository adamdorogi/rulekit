import Link from 'next/link';
import { useRouter } from 'next/router';
import type { ReactNode } from 'react';
import Nav from 'react-bootstrap/Nav';
import useSWR from 'swr';
import { projectPath } from '../lib/api';
import type { Project, Session } from '../lib/types';
import { RequestError } from './Feedback';
import { Shell } from './Shell';

const pages = [
  { key: 'rules', label: 'Rules' },
  { key: 'playground', label: 'Playground' },
  { key: 'versions', label: 'Versions' },
] as const;

interface Props {
  page: typeof pages[number]['key'];
  children: (project: Project, session: Session) => ReactNode;
}

function ProjectContent({ slug, page, session, children }: Props & { slug: string; session: Session }) {
  const { data: project, error } = useSWR<Project>(projectPath(slug));
  if (error) return <RequestError error={error} />;
  if (!project) return <p>Loading project...</p>;
  const base = '/projects/' + encodeURIComponent(slug);

  return (
    <>
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <div>
          <h1 className="h4 mb-1">{project.name}</h1>
          <div className="text-secondary small"><code>{project.slug}</code> / {project.activeVersion === null ? 'Unpublished' : 'Active v' + project.activeVersion}</div>
        </div>
        <Link href="/projects"><a className="btn btn-sm btn-outline-secondary">All projects</a></Link>
      </div>
      <Nav variant="tabs" activeKey={page} className="mb-3" aria-label="Project pages">
        {pages.map(({ key, label }) => (
          <Nav.Item key={key}>
            <Link href={base + '/' + key} passHref>
              <Nav.Link eventKey={key}>{label}</Nav.Link>
            </Link>
          </Nav.Item>
        ))}
      </Nav>
      {children(project, session)}
    </>
  );
}

export function ProjectPage({ page, children }: Props) {
  const router = useRouter();
  const slug = typeof router.query.slug === 'string' ? router.query.slug : '';
  return (
    <Shell title={'Projects / ' + pages.find((item) => item.key === page)?.label}>
      {(session) => slug ? <ProjectContent slug={slug} page={page} session={session}>{children}</ProjectContent> : null}
    </Shell>
  );
}
