import Alert from 'react-bootstrap/Alert';
import Badge from 'react-bootstrap/Badge';
import type { Outcome } from '@rulekit/engine';

export function RequestError({ error }: { error: unknown }) {
  if (!error) return null;
  return <Alert variant="danger" role="alert">{error instanceof Error ? error.message : String(error)}</Alert>;
}

export function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  return (
    <Badge bg={{ allow: 'success', deny: 'danger', review: 'warning' }[outcome]} text={outcome === 'review' ? 'dark' : undefined}>
      {outcome.toUpperCase()}
    </Badge>
  );
}

export function JsonBlock({ value }: { value: unknown }) {
  return <pre className="bg-light p-2 border small json-display mb-0">{JSON.stringify(value, null, 2)}</pre>;
}

export function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : '-';
}
