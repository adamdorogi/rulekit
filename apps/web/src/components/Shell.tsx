import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState, type ReactNode } from 'react';
import Button from 'react-bootstrap/Button';
import Nav from 'react-bootstrap/Nav';
import useSWR from 'swr';
import { api, ApiError, sessionPath } from '../lib/api';
import type { Session } from '../lib/types';
import { RequestError } from './Feedback';

const sections = [
  { href: '/projects', text: 'Projects', icon: 'collection' },
  { href: '/reviews', text: 'Review queue', icon: 'inboxes' },
  { href: '/webhooks', text: 'Webhooks', icon: 'broadcast', admin: true },
  { href: '/settings/api-keys', text: 'API keys', icon: 'key', admin: true },
];

export function Shell({ title, children }: { title: string; children: ReactNode | ((session: Session) => ReactNode) }) {
  const router = useRouter();
  const { data: session, error, mutate } = useSWR<Session, ApiError>(sessionPath);
  const [logoutError, setLogoutError] = useState<unknown>();
  const unauthenticated = error?.status === 401;

  useEffect(() => {
    if (unauthenticated) void router.replace('/login');
  }, [router, unauthenticated]);

  async function logout() {
    try {
      await api('/v1/auth/logout', { method: 'POST' });
      await mutate(undefined, false);
      await router.replace('/login');
    } catch (error) {
      setLogoutError(error);
    }
  }

  if (unauthenticated) return null;
  if (!session) return <main className="container py-4">{error ? <RequestError error={error} /> : 'Loading session...'}</main>;

  return (
    <>
      <aside className="console-aside bg-dark text-light p-3">
        <Link href="/projects"><a className="d-block h5 text-white text-decoration-none mb-3">rulekit</a></Link>
        <Nav className="flex-column gap-1" aria-label="Workspace">
          {sections.filter((item) => !item.admin || session.role === 'admin').map((item) => (
            <Link key={item.href} href={item.href} passHref>
              <Nav.Link active={router.pathname.startsWith(item.href)} className="py-2">
                <i className={'bi bi-' + item.icon + ' me-2'} aria-hidden="true" />{item.text}
              </Nav.Link>
            </Link>
          ))}
        </Nav>
      </aside>
      <div className="console-body">
        <header className="bg-white border-bottom py-2 px-3 px-lg-4 d-flex flex-wrap gap-2 align-items-center justify-content-between">
          <span className="text-secondary small">{session.workspaceName} / {title}</span>
          <div className="d-flex gap-2 align-items-center">
            <span className="small text-secondary">{session.email}</span>
            <Button size="sm" variant="outline-secondary" onClick={() => void logout()}>Sign out</Button>
          </div>
        </header>
        <main className="console-content px-3 px-lg-4 py-4">
          <RequestError error={logoutError} />
          {typeof children === 'function' ? children(session) : children}
        </main>
      </div>
    </>
  );
}
