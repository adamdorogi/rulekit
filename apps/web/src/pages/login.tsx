import { useRouter } from 'next/router';
import { useState, type FormEvent } from 'react';
import Button from 'react-bootstrap/Button';
import Card from 'react-bootstrap/Card';
import Form from 'react-bootstrap/Form';
import { useSWRConfig } from 'swr';
import { RequestError } from '../components/Feedback';
import { api, sessionPath } from '../lib/api';
import type { Session } from '../lib/types';

const development = process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_DEMO === '1';

export default function Login() {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [email, setEmail] = useState(development ? 'admin@rulekit.test' : '');
  const [password, setPassword] = useState(development ? 'rulekit-local' : '');
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    setBusy(true);
    try {
      const session = await api<Session>('/v1/auth/login', { method: 'POST', body: { email, password } });
      await mutate(sessionPath, session, false);
      await router.replace('/projects');
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="container min-vh-100 d-flex justify-content-center align-items-center py-4">
      <Card className="login-card border">
        <Card.Header className="bg-white">rulekit</Card.Header>
        <Card.Body className="p-4">
          <h1 className="h5 mb-3">Sign in</h1>
          <RequestError error={error} />
          <Form onSubmit={(event) => void signIn(event)}>
            <Form.Group className="mb-3" controlId="login-email">
              <Form.Label>Email</Form.Label>
              <Form.Control size="sm" type="email" autoComplete="username" value={email} required onChange={(event) => setEmail(event.target.value)} />
            </Form.Group>
            <Form.Group className="mb-3" controlId="login-password">
              <Form.Label>Password</Form.Label>
              <Form.Control size="sm" type="password" autoComplete="current-password" value={password} required onChange={(event) => setPassword(event.target.value)} />
            </Form.Group>
            <Button type="submit" size="sm" className="w-100" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</Button>
          </Form>
        </Card.Body>
      </Card>
    </main>
  );
}
