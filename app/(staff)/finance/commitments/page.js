'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Alert, Button, Form, Modal, Spinner, Table } from 'react-bootstrap';
import AppLayout from '@/components/AppLayout';
import AuditTimeline from '@/components/finance/AuditTimeline';
import CommitmentForm from '@/components/finance/CommitmentForm';
import FinanceWorkspace from '@/components/finance/FinanceWorkspace';
import financeStyles from '@/components/finance/FinanceWorkspace.module.css';
import EmptyState from '@/components/ui/EmptyState';
import SectionCard from '@/components/ui/SectionCard';
import StatusBadge from '@/components/ui/StatusBadge';
import Toast, { useToast } from '@/components/Toast';
import { useFinanceContext } from '@/hooks/useFinanceContext';
import { authenticatedFetch } from '@/lib/apiClient';
import { formatCurrency, formatFinanceDate } from '@/lib/financeFormat';

const STATUSES = [
  'draft',
  'submitted',
  'returned',
  'approved',
  'partially_converted',
  'converted',
  'rejected',
  'cancelled',
];

function FinanceCommitmentsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, finance, loading: contextLoading, error: contextError } = useFinanceContext();
  const { toast, showToast, hideToast } = useToast();
  const projectId = searchParams.get('projectId') || '';
  const [items, setItems] = useState([]);
  const [budgetLines, setBudgetLines] = useState([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formCommitment, setFormCommitment] = useState(undefined);
  const [selected, setSelected] = useState(null);
  const [reviewComment, setReviewComment] = useState('');

  const setProjectId = useCallback((value) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set('projectId', value); else next.delete('projectId');
    router.replace(`/finance/commitments?${next.toString()}`, { scroll: false });
  }, [router, searchParams]);

  useEffect(() => {
    if (!projectId && finance?.projects?.length) setProjectId(finance.projects[0].$id);
  }, [finance, projectId, setProjectId]);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({ projectId });
      const [commitmentResponse, summaryResponse] = await Promise.all([
        authenticatedFetch(`/api/finance/commitments?${query}`),
        authenticatedFetch(`/api/finance/summary?projectId=${encodeURIComponent(projectId)}`),
      ]);
      const [commitmentData, summaryData] = await Promise.all([
        commitmentResponse.json(),
        summaryResponse.json(),
      ]);
      if (!commitmentResponse.ok) throw new Error(commitmentData.error || 'Commitments could not be loaded.');
      if (!summaryResponse.ok) throw new Error(summaryData.error || 'Activity budgets could not be loaded.');
      setItems(commitmentData.items || commitmentData.commitments || []);
      setBudgetLines(summaryData.activities || []);
    } catch (requestError) {
      setError(requestError.message || 'Commitments could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const project = finance?.projects?.find((item) => item.$id === projectId);
  const filtered = useMemo(
    () => items.filter((item) => !status || item.status === status),
    [items, status]
  );

  const saveCommitment = async (payload) => {
    const editing = Boolean(formCommitment?.$id);
    setSubmitting(true);
    try {
      const response = await authenticatedFetch(
        editing ? `/api/finance/commitments/${formCommitment.$id}` : '/api/finance/commitments',
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Commitment could not be saved.');
      setFormCommitment(undefined);
      setSelected(data.commitment || data.item || null);
      showToast(payload.submit ? 'Commitment submitted for independent review.' : 'Commitment draft saved.', 'success');
      await load();
    } catch (requestError) {
      showToast(requestError.message || 'Commitment could not be saved.', 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  const reviewCommitment = async (action) => {
    if ((action === 'return' || action === 'reject') && !reviewComment.trim()) {
      showToast('A reviewer comment is required for this decision.', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      const response = await authenticatedFetch(`/api/finance/commitments/${selected.$id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, comment: reviewComment }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'The review decision could not be saved.');
      showToast(
        action === 'approve'
          ? 'Commitment approved.'
          : action === 'return'
            ? 'Commitment returned for correction.'
            : 'Commitment rejected.',
        'success'
      );
      setSelected(null);
      setReviewComment('');
      await load();
    } catch (requestError) {
      showToast(requestError.message || 'The review decision could not be saved.', 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  if (contextLoading) {
    return <AppLayout user={user}><div className="text-center py-5"><Spinner animation="border" /></div></AppLayout>;
  }
  if (contextError || !finance) {
    return <AppLayout user={user}><Alert variant="danger" className="mt-4">{contextError}</Alert></AppLayout>;
  }

  const canManage = Boolean(finance.actor.canManageCommitments);
  const canReview = Boolean(finance.actor.canReviewCommitments);

  return (
    <FinanceWorkspace
      user={user}
      finance={finance}
      active="commitments"
      title="Commitments"
      description="Track approved obligations separately from Actual Spend until they are converted into expenses."
      actions={canManage && (
        <Button onClick={() => setFormCommitment(null)} disabled={!project}>
          <i className="bi bi-plus-lg me-1" />New commitment
        </Button>
      )}
    >
      <Toast toast={toast} onClose={hideToast} />
      <div className={financeStyles.filterBar}>
        <div className={financeStyles.filterWide}>
          <Form.Label className="small fw-semibold">Project</Form.Label>
          <Form.Select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
            {finance.projects.map((item) => (
              <option key={item.$id} value={item.$id}>{item.code} - {item.name}</option>
            ))}
          </Form.Select>
        </div>
        <div>
          <Form.Label className="small fw-semibold">Status</Form.Label>
          <Form.Select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option>
            {STATUSES.map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}
          </Form.Select>
        </div>
        <div className="d-flex align-items-end">
          <Button variant="secondary" onClick={load} disabled={loading}>
            <i className="bi bi-arrow-clockwise me-1" />Refresh
          </Button>
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}
      <SectionCard
        title="Commitment register"
        description="Approved commitments reduce uncommitted funds; converted amounts are represented by their linked expenses."
        flush
      >
        {loading ? (
          <div className="text-center py-5"><Spinner animation="border" /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="bi-journal-check"
            title="No commitments"
            text={canManage ? 'Create a draft obligation or adjust the filters.' : 'No commitments match these filters.'}
          />
        ) : (
          <div className={financeStyles.tableWrap}>
            <Table hover className={financeStyles.dataTable}>
              <thead>
                <tr><th>Committed</th><th>Expected</th><th>Activity</th><th>Vendor</th><th>Reference</th><th className="text-end">Amount</th><th className="text-end">Outstanding</th><th>Status</th><th /></tr>
              </thead>
              <tbody>{filtered.map((item) => {
                const canEdit = canManage && item.createdBy === finance.actor.accountId && ['draft', 'returned'].includes(item.status);
                return (
                  <tr key={item.$id}>
                    <td>{formatFinanceDate(item.commitmentDate)}</td>
                    <td>{formatFinanceDate(item.expectedDate)}</td>
                    <td><strong>{item.activityCode || '-'}</strong><div className="small text-muted">{item.activityName}</div></td>
                    <td>{item.vendor}</td>
                    <td>{item.referenceNumber || '-'}</td>
                    <td className="text-end">{formatCurrency(item.amount, item.currency)}</td>
                    <td className="text-end fw-semibold">{formatCurrency(item.outstandingAmount ?? item.amount, item.currency)}</td>
                    <td><StatusBadge status={item.status} /></td>
                    <td className="text-end">
                      <div className="d-flex justify-content-end gap-1">
                        <Button size="sm" variant="secondary" onClick={() => { setSelected(item); setReviewComment(''); }}>View</Button>
                        {canEdit && <Button size="sm" variant="secondary" onClick={() => setFormCommitment(item)}>Edit</Button>}
                      </div>
                    </td>
                  </tr>
                );
              })}</tbody>
            </Table>
          </div>
        )}
      </SectionCard>

      <Modal show={formCommitment !== undefined} onHide={() => setFormCommitment(undefined)} size="lg" centered scrollable>
        <Modal.Header closeButton><Modal.Title>{formCommitment ? 'Edit commitment' : 'New commitment'}</Modal.Title></Modal.Header>
        <Modal.Body>{project && (
          <CommitmentForm
            key={formCommitment?.$id || `new-${project.$id}`}
            project={project}
            budgetLines={budgetLines}
            initialValue={formCommitment || null}
            onSubmit={saveCommitment}
            onCancel={() => setFormCommitment(undefined)}
            submitting={submitting}
          />
        )}</Modal.Body>
      </Modal>

      <Modal show={Boolean(selected)} onHide={() => setSelected(null)} size="lg" centered scrollable>
        <Modal.Header closeButton><Modal.Title>Commitment details</Modal.Title></Modal.Header>
        <Modal.Body>{selected && (
          <>
            <div className="d-flex justify-content-between align-items-start gap-3 mb-4">
              <div><h5 className="mb-1">{selected.vendor}</h5><div className="text-muted">{selected.activityCode ? `${selected.activityCode} - ` : ''}{selected.activityName}</div></div>
              <StatusBadge status={selected.status} />
            </div>
            <div className="row g-3 mb-4">
              {[
                ['Amount', formatCurrency(selected.amount, selected.currency)],
                ['Commitment date', formatFinanceDate(selected.commitmentDate)],
                ['Expected settlement', formatFinanceDate(selected.expectedDate)],
                ['Reference', selected.referenceNumber || '-'],
                ['Created by', selected.createdByName || '-'],
                ['Converted to expense', formatCurrency(selected.settledAmount || 0, selected.currency)],
                ['Outstanding', formatCurrency(selected.outstandingAmount ?? selected.amount, selected.currency)],
              ].map(([label, value]) => (
                <div className="col-sm-6" key={label}><small className="text-muted d-block">{label}</small><strong>{value}</strong></div>
              ))}
            </div>
            <Alert variant="light" className="border"><strong>Description:</strong> {selected.description}</Alert>
            {selected.reviewerComment && <Alert variant="info"><strong>Reviewer comment:</strong> {selected.reviewerComment}</Alert>}
            <AuditTimeline record={selected} />

            {canReview && selected.status === 'submitted' && (
              <div className="border-top mt-4 pt-4">
                {selected.createdBy === finance.actor.accountId && (
                  <Alert variant="danger">Self-approval is prohibited. Another authorized reviewer must decide this commitment.</Alert>
                )}
                <Form.Group className="mb-3" controlId="commitment-review-comment">
                  <Form.Label>Reviewer comment</Form.Label>
                  <Form.Control as="textarea" rows={3} maxLength={1000} value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} placeholder="Required for return or rejection" />
                </Form.Group>
                <div className="d-flex flex-wrap justify-content-end gap-2">
                  <Button variant="secondary" onClick={() => reviewCommitment('return')} disabled={submitting || selected.createdBy === finance.actor.accountId}>Return for correction</Button>
                  <Button variant="outline-danger" onClick={() => reviewCommitment('reject')} disabled={submitting || selected.createdBy === finance.actor.accountId}>Reject</Button>
                  <Button variant="success" onClick={() => reviewCommitment('approve')} disabled={submitting || selected.createdBy === finance.actor.accountId}>
                    {submitting ? <Spinner size="sm" animation="border" /> : 'Approve'}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}</Modal.Body>
      </Modal>
    </FinanceWorkspace>
  );
}

export default function FinanceCommitmentsPage() {
  return (
    <Suspense fallback={<AppLayout><div className="text-center py-5"><Spinner animation="border" /></div></AppLayout>}>
      <FinanceCommitmentsContent />
    </Suspense>
  );
}
