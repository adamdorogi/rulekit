import Alert from 'react-bootstrap/Alert';
import Badge from 'react-bootstrap/Badge';
import { ApiError } from '../lib/api';
import type { Outcome } from '@rulekit/engine';

export function RequestError({ error }: { error: unknown }) {
  if (!error) return null;
  const details = error instanceof ApiError && Array.isArray(error.details) ? error.details : [];
  return (
    <Alert variant="danger" role="alert">
      {error instanceof Error ? error.message : String(error)}
      {details.length > 0 && (
        <ul className="mb-0 mt-1">
          {details.map((issue, index) => (
            <li key={index}>
              {Array.isArray(issue.path) ? issue.path.join('.') + ' - ' : issue.ruleId ? issue.ruleId + ' - ' : ''}
              {issue.message}
            </li>
          ))}
        </ul>
      )}
    </Alert>
  );
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
