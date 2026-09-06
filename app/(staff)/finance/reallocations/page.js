'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Alert, Button, Form, Modal, Spinner, Table } from 'react-bootstrap';
import AppLayout from '@/components/AppLayout';
import FinanceWorkspace from '@/components/finance/FinanceWorkspace';
import financeStyles from '@/components/finance/FinanceWorkspace.module.css';
import ReallocationForm from '@/components/finance/ReallocationForm';
import EmptyState from '@/components/ui/EmptyState';
import SectionCard from '@/components/ui/SectionCard';
import StatusBadge from '@/components/ui/StatusBadge';
import Toast, { useToast } from '@/components/Toast';
import { useFinanceContext } from '@/hooks/useFinanceContext';
import { authenticatedFetch } from '@/lib/apiClient';
import { formatCurrency, formatFinanceDate } from '@/lib/financeFormat';

function BudgetReallocationsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, finance, loading: contextLoading, error: contextError } = useFinanceContext();
  const { toast, showToast, hideToast } = useToast();
  const projectId = searchParams.get('projectId') || '';
  const [records, setRecords] = useState([]);
  const [budgetLines, setBudgetLines] = useState([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(undefined);

  const setProjectId = useCallback((value) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set('projectId', value); else next.delete('projectId');
    router.replace(`/finance/reallocations?${next.toString()}`, { scroll: false });
  }, [router, searchParams]);

  useEffect(() => {
    if (!projectId && finance?.projects?.length) setProjectId(finance.projects[0].$id);
  }, [finance, projectId, setProjectId]);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError('');
    try {
      const [recordResponse, summaryResponse] = await Promise.all([
        authenticatedFetch(`/api/finance/reallocations?projectId=${encodeURIComponent(projectId)}`),
        authenticatedFetch(`/api/finance/summary?projectId=${encodeURIComponent(projectId)}`),
      ]);
      const [recordData, summaryData] = await Promise.all([recordResponse.json(), summaryResponse.json()]);
      if (!recordResponse.ok) throw new Error(recordData.error || 'Reallocations could not be loaded.');
      if (!summaryResponse.ok) throw new Error(summaryData.error || 'Activity budgets could not be loaded.');
      setRecords(recordData.reallocations || []);
      setBudgetLines(summaryData.activities || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);
  const project = finance?.projects?.find((item) => item.$id === projectId);
  const filtered = useMemo(() => records.filter((record) => !status || record.status === status), [records, status]);

  const save = async (payload) => {
    setSubmitting(true);
    try {
      const response = await authenticatedFetch(editing?.$id ? `/api/finance/reallocations/${editing.$id}` : '/api/finance/reallocations', {
        method: editing?.$id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Reallocation could not be submitted.');
      showToast('Reallocation submitted for independent review.', 'success');
      setEditing(undefined);
      await load();
    } catch (requestError) {
      showToast(requestError.message, 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  if (contextLoading) return <AppLayout user={user}><div className="text-center py-5"><Spinner animation="border" /></div></AppLayout>;
  if (contextError || !finance) return <AppLayout user={user}><Alert variant="danger" className="mt-4">{contextError}</Alert></AppLayout>;

  return (
    <FinanceWorkspace
      user={user}
      finance={finance}
      active="reallocations"
      title="Budget Reallocations"
      description="Move available allocation between approved activities without rewriting the original approved budget."
      actions={finance.actor.canEdit && <Button onClick={() => setEditing(null)} disabled={!project}><i className="bi bi-plus-lg me-1" />New reallocation</Button>}
    >
      <Toast toast={toast} onClose={hideToast} />
      <div className={financeStyles.filterBar}>
        <div className={financeStyles.filterWide}><Form.Label className="small fw-semibold">Project</Form.Label><Form.Select value={projectId} onChange={(event) => setProjectId(event.target.value)}>{finance.projects.map((item) => <option key={item.$id} value={item.$id}>{item.code} · {item.name}</option>)}</Form.Select></div>
        <div><Form.Label className="small fw-semibold">Status</Form.Label><Form.Select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option><option value="submitted">Needs review</option><option value="returned">Returned</option><option value="approved">Approved</option><option value="rejected">Rejected</option></Form.Select></div>
        <div className="d-flex align-items-end"><Button variant="secondary" onClick={load} disabled={loading}><i className="bi bi-arrow-clockwise me-1" />Refresh</Button></div>
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      <SectionCard title="Transfer history" description="Every request, reviewer decision, and approved transfer remains visible." flush>
        {loading ? <div className="text-center py-5"><Spinner animation="border" /></div> : filtered.length === 0 ? <EmptyState icon="bi-arrow-left-right" title="No reallocations" text="No transfer request matches this project and status." /> : (
          <div className={financeStyles.tableWrap}>
            <Table hover className={financeStyles.dataTable}>
              <thead><tr><th>Requested</th><th>From activity</th><th>To activity</th><th className="text-end">Amount</th><th>Reason</th><th>Requested by</th><th>Status</th><th>Reviewed</th><th /></tr></thead>
              <tbody>{filtered.map((record) => {
                const canEdit = finance.actor.canEdit && record.createdBy === finance.actor.accountId && ['draft','returned'].includes(record.status);
                return <tr key={record.$id}>
                  <td>{formatFinanceDate(record.$createdAt)}</td>
                  <td><div className="fw-semibold">{record.fromActivityCode || '—'}</div><small className="text-muted">{record.fromActivityName}</small></td>
                  <td><div className="fw-semibold">{record.toActivityCode || '—'}</div><small className="text-muted">{record.toActivityName}</small></td>
                  <td className="text-end fw-semibold">{formatCurrency(record.amount, record.currency)}</td>
                  <td style={{ maxWidth: 260 }}><div className="text-truncate" title={record.reason}>{record.reason}</div>{record.reviewerComment && <small className="text-muted">Reviewer: {record.reviewerComment}</small>}</td>
                  <td>{record.createdByName}</td><td><StatusBadge status={record.status} /></td><td>{formatFinanceDate(record.reviewedAt)}</td>
                  <td className="text-end">{canEdit && <Button size="sm" variant="secondary" onClick={() => setEditing(record)}>Edit</Button>}</td>
                </tr>;
              })}</tbody>
            </Table>
          </div>
        )}
      </SectionCard>

      <Modal show={editing !== undefined} onHide={() => setEditing(undefined)} size="lg" centered>
        <Modal.Header closeButton><Modal.Title>{editing ? 'Revise returned reallocation' : 'New budget reallocation'}</Modal.Title></Modal.Header>
        <Modal.Body>{project && <ReallocationForm project={project} budgetLines={budgetLines} initialValue={editing || null} onSubmit={save} onCancel={() => setEditing(undefined)} submitting={submitting} />}</Modal.Body>
      </Modal>
    </FinanceWorkspace>
  );
}

export default function BudgetReallocationsPage() {
  return (
    <Suspense fallback={<AppLayout><div className="text-center py-5"><Spinner animation="border" /></div></AppLayout>}>
      <BudgetReallocationsContent />
    </Suspense>
  );
}
