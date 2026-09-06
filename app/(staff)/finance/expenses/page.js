'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Alert, Button, Form, Modal, Spinner, Table } from 'react-bootstrap';
import AppLayout from '@/components/AppLayout';
import AdjustmentForm from '@/components/finance/AdjustmentForm';
import ExpenseEvidencePanel from '@/components/finance/ExpenseEvidencePanel';
import ExpenditureForm from '@/components/finance/ExpenditureForm';
import FinanceWorkspace from '@/components/finance/FinanceWorkspace';
import financeStyles from '@/components/finance/FinanceWorkspace.module.css';
import EmptyState from '@/components/ui/EmptyState';
import SectionCard from '@/components/ui/SectionCard';
import StatusBadge from '@/components/ui/StatusBadge';
import Toast, { useToast } from '@/components/Toast';
import { useFinanceContext } from '@/hooks/useFinanceContext';
import { authenticatedFetch } from '@/lib/apiClient';
import { formatCurrency, formatFinanceDate, titleCase } from '@/lib/financeFormat';

const CATEGORIES = ['personnel', 'travel', 'supplies', 'equipment', 'services', 'training', 'communications', 'venue', 'other'];
const STATUSES = ['draft', 'submitted', 'returned', 'approved', 'rejected'];

/**
 * Server-side filters (projectId, status, activityId, category, from, to) are
 * URL state — refreshable, bookmarkable, shareable, and back/forward-safe
 * (Section 5). Only the free-text search box filters client-side, since it
 * has no indexed backing field.
 */
function FinanceExpensesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, finance, loading: contextLoading, error: contextError } = useFinanceContext();
  const { toast, showToast, hideToast } = useToast();
  const [expenses, setExpenses] = useState([]);
  const [budgetLines, setBudgetLines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formExpense, setFormExpense] = useState(undefined);
  const [detailExpense, setDetailExpense] = useState(null);
  const [adjustExpense, setAdjustExpense] = useState(null);
  const [search, setSearch] = useState('');

  const projectId = searchParams.get('projectId') || '';
  const activityId = searchParams.get('activityId') || '';
  const category = searchParams.get('category') || '';
  const status = searchParams.get('status') || '';
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';

  const setParam = useCallback((key, value) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value); else next.delete(key);
    router.replace(`/finance/expenses?${next.toString()}`, { scroll: false });
  }, [router, searchParams]);

  useEffect(() => {
    if (!projectId && finance?.projects?.length) setParam('projectId', finance.projects[0].$id);
  }, [finance, projectId, setParam]);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({ projectId });
      if (activityId) query.set('activityId', activityId);
      if (category) query.set('category', category);
      if (status) query.set('status', status);
      if (from) query.set('from', from);
      if (to) query.set('to', to);
      const [expenseResponse, summaryResponse] = await Promise.all([
        authenticatedFetch(`/api/finance/expenditures?${query}`),
        authenticatedFetch(`/api/finance/summary?projectId=${encodeURIComponent(projectId)}`),
      ]);
      const [expenseData, summaryData] = await Promise.all([expenseResponse.json(), summaryResponse.json()]);
      if (!expenseResponse.ok) throw new Error(expenseData.error || 'Expenses could not be loaded.');
      if (!summaryResponse.ok) throw new Error(summaryData.error || 'Activity budgets could not be loaded.');
      setExpenses(expenseData.expenditures || []);
      setBudgetLines(summaryData.activities || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [projectId, activityId, category, status, from, to]);

  useEffect(() => { load(); }, [load]);

  const project = finance?.projects?.find((item) => item.$id === projectId);
  // Server already applied activity/category/status/date filters — only the
  // free-text search narrows further, client-side, over that result set.
  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    if (!term) return expenses;
    return expenses.filter((expense) => (
      [expense.description, expense.payee, expense.referenceNumber, expense.responsibleStaffName]
        .some((value) => String(value || '').toLowerCase().includes(term))
    ));
  }, [expenses, search]);

  const saveExpense = async (payload) => {
    setSubmitting(true);
    const editing = Boolean(formExpense?.$id);
    try {
      const response = await authenticatedFetch(editing ? `/api/finance/expenditures/${formExpense.$id}` : '/api/finance/expenditures', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Expense could not be saved.');
      setFormExpense(undefined);
      setDetailExpense(data.expenditure);
      showToast(editing ? 'Expense draft updated.' : 'Expense draft created. Add evidence before submission.', 'success');
      await load();
    } catch (requestError) {
      showToast(requestError.message, 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  const submitAdjustment = async (payload) => {
    setSubmitting(true);
    try {
      const response = await authenticatedFetch('/api/finance/adjustments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Adjustment could not be submitted.');
      setAdjustExpense(null);
      showToast('Adjustment submitted for independent review.', 'success');
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
      active="expenses"
      title="Expenses"
      description="Transaction-level control with explicit responsibility, protected evidence, independent review, and immutable approved history."
      actions={finance.actor.canEdit && <Button onClick={() => setFormExpense(null)} disabled={!project}><i className="bi bi-plus-lg me-1" />New expense</Button>}
    >
      <Toast toast={toast} onClose={hideToast} />
      <div className={financeStyles.filterBar}>
        <div className={financeStyles.filterWide}><Form.Label className="small fw-semibold">Search</Form.Label><Form.Control placeholder="Description, payee, reference, staff…" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        <div><Form.Label className="small fw-semibold">Project</Form.Label><Form.Select value={projectId} onChange={(event) => setParam('projectId', event.target.value)}>{finance.projects.map((item) => <option key={item.$id} value={item.$id}>{item.code} · {item.name}</option>)}</Form.Select></div>
        <div><Form.Label className="small fw-semibold">Activity</Form.Label><Form.Select value={activityId} onChange={(event) => setParam('activityId', event.target.value)}><option value="">All activities</option>{budgetLines.map((line) => <option key={line.$id} value={line.activityId || ''}>{line.activityCode ? `${line.activityCode} · ` : ''}{line.activityName}</option>)}</Form.Select></div>
        <div><Form.Label className="small fw-semibold">Category</Form.Label><Form.Select value={category} onChange={(event) => setParam('category', event.target.value)}><option value="">All categories</option>{CATEGORIES.map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}</Form.Select></div>
        <div><Form.Label className="small fw-semibold">Status</Form.Label><Form.Select value={status} onChange={(event) => setParam('status', event.target.value)}><option value="">All statuses</option>{STATUSES.map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}</Form.Select></div>
        <div><Form.Label className="small fw-semibold">From</Form.Label><Form.Control type="date" value={from} onChange={(event) => setParam('from', event.target.value)} /></div>
        <div><Form.Label className="small fw-semibold">To</Form.Label><Form.Control type="date" value={to} onChange={(event) => setParam('to', event.target.value)} /></div>
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      <SectionCard title="Expense register" description={`${filtered.length} of ${expenses.length} transactions`} flush>
        {loading ? <div className="text-center py-5"><Spinner animation="border" /></div> : filtered.length === 0 ? <EmptyState icon="bi-receipt" title="No matching expenses" text="Adjust filters or create the first expense draft." /> : (
          <div className={financeStyles.tableWrap}>
            <Table hover className={financeStyles.dataTable}>
              <thead><tr><th>Date</th><th>Activity</th><th>Description</th><th>Category</th><th>Payee</th><th>Responsible person</th><th className="text-end">Amount</th><th>Status</th><th>Evidence</th><th /></tr></thead>
              <tbody>{filtered.map((expense) => {
                const canEdit = finance.actor.canEdit && expense.createdBy === finance.actor.accountId && ['draft', 'returned'].includes(expense.status);
                return (
                  <tr key={expense.$id}>
                    <td>{formatFinanceDate(expense.expenseDate)}</td>
                    <td><div className="fw-semibold">{expense.activityCode || '—'}</div><small className="text-muted">{expense.activityName}</small></td>
                    <td style={{ maxWidth: 240 }}><div className="text-truncate">{expense.description}</div><small className="text-muted">{expense.referenceNumber || 'No reference'}</small></td>
                    <td>{titleCase(expense.category)}</td><td>{expense.payee}</td><td>{expense.responsibleStaffName}</td>
                    <td className="text-end fw-semibold">{formatCurrency(expense.amount, expense.currency)}</td><td><StatusBadge status={expense.status} /></td>
                    <td>{expense.evidenceMetadata?.length ? <span className="text-success"><i className="bi bi-paperclip me-1" />{expense.evidenceMetadata.length}</span> : <span className="text-muted">None</span>}</td>
                    <td className="text-end"><div className="d-flex justify-content-end gap-1"><Button size="sm" variant="secondary" onClick={() => setDetailExpense(expense)}>View</Button>{canEdit && <Button size="sm" variant="secondary" onClick={() => setFormExpense(expense)}>Edit</Button>}{finance.actor.canEdit && expense.status === 'approved' && <Button size="sm" variant="secondary" onClick={() => setAdjustExpense(expense)}>Adjust</Button>}</div></td>
                  </tr>
                );
              })}</tbody>
            </Table>
          </div>
        )}
      </SectionCard>

      <Modal show={formExpense !== undefined} onHide={() => setFormExpense(undefined)} size="lg" centered>
        <Modal.Header closeButton><Modal.Title>{formExpense ? 'Edit expense draft' : 'New expense draft'}</Modal.Title></Modal.Header>
        <Modal.Body>{project && <ExpenditureForm project={project} budgetLines={budgetLines} staff={finance.staff} initialValue={formExpense || null} onSubmit={saveExpense} onCancel={() => setFormExpense(undefined)} submitting={submitting} />}</Modal.Body>
      </Modal>

      <Modal show={Boolean(detailExpense)} onHide={() => setDetailExpense(null)} size="lg" centered scrollable>
        <Modal.Header closeButton><Modal.Title>Expense details</Modal.Title></Modal.Header>
        <Modal.Body>{detailExpense && <>
          <div className="d-flex justify-content-between align-items-start gap-3 mb-4"><div><h5 className="mb-1">{detailExpense.description}</h5><div className="text-muted">{detailExpense.activityCode ? `${detailExpense.activityCode} · ` : ''}{detailExpense.activityName}</div></div><StatusBadge status={detailExpense.status} /></div>
          <div className="row g-3 mb-4">
            {[['Amount', formatCurrency(detailExpense.amount, detailExpense.currency)],['Date', formatFinanceDate(detailExpense.expenseDate)],['Payee', detailExpense.payee],['Responsible staff', detailExpense.responsibleStaffName],['Category', titleCase(detailExpense.category)],['Payment method', titleCase(detailExpense.paymentMethod)],['Reference', detailExpense.referenceNumber || '—'],['Entered by', detailExpense.createdByName]].map(([label, value]) => <div className="col-sm-6" key={label}><small className="text-muted d-block">{label}</small><strong>{value}</strong></div>)}
          </div>
          {detailExpense.reviewerComment && <Alert variant={detailExpense.status === 'rejected' ? 'danger' : 'info'}><strong>Reviewer comment:</strong> {detailExpense.reviewerComment}</Alert>}
          <ExpenseEvidencePanel expense={detailExpense} canEdit={finance.actor.canEdit && detailExpense.createdBy === finance.actor.accountId && ['draft','returned'].includes(detailExpense.status)} notify={showToast} onChanged={(updated) => { setDetailExpense(updated); load(); }} />
        </>}</Modal.Body>
      </Modal>

      <Modal show={Boolean(adjustExpense)} onHide={() => setAdjustExpense(null)} size="lg" centered>
        <Modal.Header closeButton><Modal.Title>Adjust approved expense</Modal.Title></Modal.Header>
        <Modal.Body>{adjustExpense && <AdjustmentForm expense={adjustExpense} onSubmit={submitAdjustment} onCancel={() => setAdjustExpense(null)} submitting={submitting} />}</Modal.Body>
      </Modal>
    </FinanceWorkspace>
  );
}

export default function FinanceExpensesPage() {
  return (
    <Suspense fallback={<AppLayout><div className="text-center py-5"><Spinner animation="border" /></div></AppLayout>}>
      <FinanceExpensesContent />
    </Suspense>
  );
}
