import { useState, type FormEvent } from 'react';
import Alert from 'react-bootstrap/Alert';
import Badge from 'react-bootstrap/Badge';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Modal from 'react-bootstrap/Modal';
import Table from 'react-bootstrap/Table';
import useSWR from 'swr';
import { formatDate, JsonBlock, RequestError } from '../components/Feedback';
import { Shell } from '../components/Shell';
import { api } from '../lib/api';
import type { Session } from '../lib/types';

type Resolution = 'approved' | 'rejected';
interface Review {
  id: string;
  status: 'pending' | Resolution;
  note: string | null;
  createdAt: string;
  evaluation: {
    input: unknown;
    matchedRuleIds: string[];
    outcome: 'review';
    versionNumber: number;
    project: { name: string; slug: string };
  };
}

const path = '/v1/reviews';

function ReviewModal({ review, canResolve, onClose, onResolve }: {
  review: Review;
  canResolve: boolean;
  onClose: () => void;
  onResolve: () => Promise<unknown>;
}) {
  const [note, setNote] = useState('');
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);

  async function resolve(status: Resolution) {
    setError(undefined);
    setBusy(true);
    try {
      await api(path + '/' + encodeURIComponent(review.id) + '/resolve', {
        method: 'POST',
        body: { status, note: note.trim() },
      });
      await onResolve();
      onClose();
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (submitter?.value === 'approved' || submitter?.value === 'rejected') void resolve(submitter.value);
  }

  return (
    <Modal size="lg" show onHide={() => { if (!busy) onClose(); }}>
      <Modal.Header closeButton={!busy}><Modal.Title>Review evaluation</Modal.Title></Modal.Header>
      <Form onSubmit={submit}>
        <Modal.Body>
          <RequestError error={error} />
          <p className="small">{review.evaluation.project.name} / <code>v{review.evaluation.versionNumber}</code></p>
          <h2 className="h6">Input payload</h2>
          <JsonBlock value={review.evaluation.input} />
          <p className="small my-3">Matched rules <code>{review.evaluation.matchedRuleIds.join(', ') || '-'}</code></p>
          {canResolve && review.status === 'pending' ? (
            <Form.Group controlId="review-note">
              <Form.Label>Reviewer comment</Form.Label>
              <Form.Control as="textarea" rows={3} size="sm" required value={note} onChange={(event) => setNote(event.target.value)} />
            </Form.Group>
          ) : review.note && <p className="small mb-0">Reviewer comment: {review.note}</p>}
        </Modal.Body>
        <Modal.Footer>
          <Button size="sm" variant="outline-secondary" disabled={busy} onClick={onClose}>Close</Button>
          {canResolve && review.status === 'pending' && (
            <>
              <Button type="submit" value="rejected" size="sm" variant="danger" disabled={busy || !note.trim()}>Reject</Button>
              <Button type="submit" value="approved" size="sm" variant="success" disabled={busy || !note.trim()}>Approve</Button>
            </>
          )}
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

function ReviewQueue({ session }: { session: Session }) {
  const { data, error, mutate } = useSWR<Review[]>(path, { refreshInterval: 5000 });
  const [status, setStatus] = useState('pending');
  const [selected, setSelected] = useState<Review>();
  const [notice, setNotice] = useState('');
  const rows = data?.filter((review) => status === 'all' || review.status === status);
  return (
    <>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <h1 className="h4 mb-0">Review queue</h1>
        <Form.Select className="w-auto" size="sm" aria-label="Filter review status" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="all">All</option>
        </Form.Select>
      </div>
      <RequestError error={error} />
      {notice && <Alert variant="success" className="py-2">{notice}</Alert>}
      <Table responsive striped bordered hover size="sm" className="bg-white small">
        <thead className="table-light"><tr><th>Project</th><th>Version</th><th>Matched rules</th><th>Queued at</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>
          {rows?.map((review) => (
            <tr key={review.id}>
              <td>{review.evaluation.project.name}</td>
              <td><code>v{review.evaluation.versionNumber}</code></td>
              <td><code>{review.evaluation.matchedRuleIds.join(', ') || '-'}</code></td>
              <td>{formatDate(review.createdAt)}</td>
              <td><Badge bg={{ pending: 'warning', approved: 'success', rejected: 'danger' }[review.status]} text={review.status === 'pending' ? 'dark' : undefined}>{review.status}</Badge></td>
              <td><Button size="sm" variant="outline-secondary" onClick={() => setSelected(review)}>Inspect</Button></td>
            </tr>
          ))}
          {rows?.length === 0 && <tr><td colSpan={6}>No reviews in this queue.</td></tr>}
        </tbody>
      </Table>
      {selected && <ReviewModal review={selected} canResolve={session.role !== 'viewer'} onClose={() => setSelected(undefined)} onResolve={async () => {
        await mutate();
        setNotice('Review resolved.');
      }} />}
    </>
  );
}

export default function ReviewsPage() {
  return <Shell title="Review queue">{(session) => <ReviewQueue session={session} />}</Shell>;
}
