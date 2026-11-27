'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, ButtonGroup, Form, Modal, Spinner } from 'react-bootstrap';
import AppLayout from '@/components/AppLayout';
import ExpenseEvidencePanel from '@/components/finance/ExpenseEvidencePanel';
import FinanceWorkspace from '@/components/finance/FinanceWorkspace';
import financeStyles from '@/components/finance/FinanceWorkspace.module.css';
import EmptyState from '@/components/ui/EmptyState';
import StatusBadge from '@/components/ui/StatusBadge';
import Toast, { useToast } from '@/components/Toast';
import { useFinanceContext } from '@/hooks/useFinanceContext';
import { authenticatedFetch } from '@/lib/apiClient';
import { formatCurrency, formatFinanceDate, titleCase } from '@/lib/financeFormat';

const SECTIONS = [
  { key: 'needsReview', label: 'Needs Review' },
  { key: 'returned', label: 'Returned' },
  { key: 'recentlyApproved', label: 'Recently Approved' },
  { key: 'rejected', label: 'Rejected' },
];

const KIND = {
  budgetLine: { label: 'Activity budget', endpoint: 'budget-lines', icon: 'bi-wallet2' },
  expenditure: { label: 'Expense', endpoint: 'expenditures', icon: 'bi-receipt' },
  reallocation: { label: 'Reallocation', endpoint: 'reallocations', icon: 'bi-arrow-left-right' },
  adjustment: { label: 'Adjustment / reversal', endpoint: 'adjustments', icon: 'bi-arrow-counterclockwise' },
};

function recordTitle(item) {
  if (item.kind === 'reallocation') return `${item.fromActivityName} → ${item.toActivityName}`;
  if (item.kind === 'adjustment') return `${titleCase(item.adjustmentType)} · ${item.activityName}`;
  return item.activityName || item.description || 'Finance record';
}

function recordAmount(item) {
  return formatCurrency(item.originalAmount ?? item.amount, item.currency);
}

export default function FinanceReviewQueuePage() {
  const { user, finance, loading: contextLoading, error: contextError } = useFinanceContext();
  const { toast, showToast, hideToast } = useToast();
  const [queue, setQueue] = useState(null);
  const [section, setSection] = useState('needsReview');
  const [selected, setSelected] = useState(null);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!finance?.actor?.canReview) return;
    setLoading(true);
    setError('');
    try {
      const response = await authenticatedFetch('/api/finance/review-queue');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Review queue could not be loaded.');
      setQueue(data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [finance]);

  useEffect(() => { load(); }, [load]);
  const items = queue?.[section] || [];
  const projectById = useMemo(() => new Map((finance?.projects || []).map((project) => [project.$id, project])), [finance]);

  const act = async (action) => {
    if ((action === 'return' || action === 'reject') && !comment.trim()) {
      showToast('A reviewer comment is required for this decision.', 'warning');
      return;
    }
    setActing(true);
    try {
      const meta = KIND[selected.kind];
      const response = await authenticatedFetch(`/api/finance/${meta.endpoint}/${selected.$id}/approve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, comment }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Review decision could not be saved.');
      showToast(`Record ${action === 'approve' ? 'approved' : action === 'return' ? 'returned for correction' : 'rejected'}.`, 'success');
      setSelected(null);
      setComment('');
      await load();
    } catch (requestError) {
      showToast(requestError.message, 'danger');
    } finally {
      setActing(false);
    }
  };

  if (contextLoading) return <AppLayout user={user}><div className="text-center py-5"><Spinner animation="border" /></div></AppLayout>;
  if (contextError || !finance) return <AppLayout user={user}><Alert variant="danger" className="mt-4">{contextError}</Alert></AppLayout>;

  return (
    <FinanceWorkspace user={user} finance={finance} active="review" title="Finance Review Queue" description="Inspect the complete record and supporting evidence before making an independent decision.">
      <Toast toast={toast} onClose={hideToast} />
      {!finance.actor.canReview ? (
        <Alert variant="warning">This workspace is restricted to configured Finance Reviewers. Management retains read-only visibility elsewhere in Finance.</Alert>
      ) : (
        <>
          <div className="d-flex flex-wrap justify-content-between gap-3 mb-4">
            <ButtonGroup>
              {SECTIONS.map((item) => <Button key={item.key} variant={section === item.key ? 'primary' : 'secondary'} onClick={() => setSection(item.key)}>{item.label} {queue ? `(${queue[item.key].length})` : ''}</Button>)}
            </ButtonGroup>
            <Button variant="secondary" onClick={load} disabled={loading}><i className="bi bi-arrow-clockwise me-1" />Refresh</Button>
          </div>
          {error && <Alert variant="danger">{error}</Alert>}
          {loading ? <div className="text-center py-5"><Spinner animation="border" /></div> : items.length === 0 ? <EmptyState icon="bi-check2-circle" title={`No items in ${SECTIONS.find((item) => item.key === section)?.label}`} text="The queue is current." /> : (
            <div className="d-flex flex-column gap-3">
              {items.map((item) => {
                const meta = KIND[item.kind];
                const project = projectById.get(item.projectId);
                return <article className={financeStyles.reviewCard} key={`${item.kind}-${item.$id}`}>
                  <div className="d-flex flex-column flex-md-row justify-content-between gap-3">
                    <div>
                      <div className={financeStyles.reviewMeta}><span className="text-primary fw-bold small"><i className={`bi ${meta.icon} me-1`} />{meta.label}</span><StatusBadge status={item.status} /><span className="small text-muted">{project ? `${project.code} · ${project.name}` : 'Project'}</span></div>
                      <h3 className="h6 mt-2 mb-1">{recordTitle(item)}</h3>
                      <div className="fw-bold">{recordAmount(item)}</div>
                      <small className="text-muted">Submitted by {item.createdByName} · {formatFinanceDate(item.submittedAt || item.$createdAt)}</small>
                    </div>
                    <div className="align-self-md-center"><Button variant="secondary" onClick={() => { setSelected(item); setComment(''); }}>Review full details</Button></div>
                  </div>
                </article>;
              })}
            </div>
          )}
        </>
      )}

      <Modal show={Boolean(selected)} onHide={() => setSelected(null)} size="lg" centered scrollable>
        <Modal.Header closeButton><Modal.Title>{selected ? KIND[selected.kind].label : 'Finance review'}</Modal.Title></Modal.Header>
        <Modal.Body>{selected && <>
          <div className="d-flex justify-content-between align-items-start gap-3 mb-4"><div><h5 className="mb-1">{recordTitle(selected)}</h5><div className="text-muted">{projectById.get(selected.projectId)?.name}</div></div><StatusBadge status={selected.status} /></div>
          <div className="row g-3 mb-4">
            <div className="col-sm-6"><small className="text-muted d-block">Amount</small><strong>{recordAmount(selected)}</strong></div>
            <div className="col-sm-6"><small className="text-muted d-block">Submitted by</small><strong>{selected.createdByName}</strong></div>
            {selected.kind === 'expenditure' && <><div className="col-sm-6"><small className="text-muted d-block">Payee</small><strong>{selected.payee}</strong></div><div className="col-sm-6"><small className="text-muted d-block">Responsible staff</small><strong>{selected.responsibleStaffName}</strong></div><div className="col-sm-6"><small className="text-muted d-block">Expense date</small><strong>{formatFinanceDate(selected.expenseDate)}</strong></div><div className="col-sm-6"><small className="text-muted d-block">Payment / reference</small><strong>{titleCase(selected.paymentMethod)} · {selected.referenceNumber || 'No reference'}</strong></div></>}
            {selected.kind === 'reallocation' && <><div className="col-sm-6"><small className="text-muted d-block">From</small><strong>{selected.fromActivityCode || '—'} · {selected.fromActivityName}</strong></div><div className="col-sm-6"><small className="text-muted d-block">To</small><strong>{selected.toActivityCode || '—'} · {selected.toActivityName}</strong></div></>}
          </div>
          {(selected.description || selected.reason || selected.notes) && <Alert variant="light"><strong>Context:</strong> {selected.description || selected.reason || selected.notes}</Alert>}
          {selected.kind === 'expenditure' && <div className="mb-4"><ExpenseEvidencePanel expense={selected} canEdit={false} notify={showToast} /></div>}
          {selected.status === 'submitted' && <>
            {selected.createdBy === finance.actor.accountId && <Alert variant="danger">Self-approval is prohibited. This record must be reviewed by another configured reviewer.</Alert>}
            <Form.Group className="mb-3"><Form.Label>Reviewer comment</Form.Label><Form.Control as="textarea" rows={3} maxLength={1000} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Required for return or rejection; recommended for approval" /></Form.Group>
            <div className="d-flex flex-wrap justify-content-end gap-2">
              <Button variant="secondary" onClick={() => act('return')} disabled={acting || selected.createdBy === finance.actor.accountId}>Return for correction</Button>
              <Button variant="outline-danger" onClick={() => act('reject')} disabled={acting || selected.createdBy === finance.actor.accountId}>Reject</Button>
              <Button variant="success" onClick={() => act('approve')} disabled={acting || selected.createdBy === finance.actor.accountId}>{acting ? <Spinner size="sm" animation="border" /> : 'Approve'}</Button>
            </div>
          </>}
        </>}</Modal.Body>
      </Modal>
    </FinanceWorkspace>
  );
}
