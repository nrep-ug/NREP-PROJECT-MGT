'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Alert, Button, Form, Modal, Spinner, Table } from 'react-bootstrap';
import AppLayout from '@/components/AppLayout';
import BudgetLineForm from '@/components/finance/BudgetLineForm';
import BudgetProposalDetail from '@/components/finance/BudgetProposalDetail';
import ActivityStructureManager from '@/components/finance/ActivityStructureManager';
import FinanceWorkspace from '@/components/finance/FinanceWorkspace';
import financeStyles from '@/components/finance/FinanceWorkspace.module.css';
import VarianceBadge from '@/components/finance/VarianceBadge';
import VarianceExplanationForm from '@/components/finance/VarianceExplanationForm';
import EmptyState from '@/components/ui/EmptyState';
import SectionCard from '@/components/ui/SectionCard';
import StatusBadge from '@/components/ui/StatusBadge';
import ClearanceStatus from '@/components/finance/ClearanceStatus';
import Toast, { useToast } from '@/components/Toast';
import { useFinanceContext } from '@/hooks/useFinanceContext';
import { authenticatedFetch } from '@/lib/apiClient';
import { formatCurrency, formatPercent } from '@/lib/financeFormat';

function ActivityBudgetsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, finance, loading: contextLoading, error: contextError } = useFinanceContext();
  const { toast, showToast, hideToast } = useToast();
  const projectId = searchParams.get('projectId') || '';
  const activityId = searchParams.get('activityId') || '';
  const [budgetLines, setBudgetLines] = useState([]);
  const [performance, setPerformance] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showStructure, setShowStructure] = useState(false);
  const [varianceLine, setVarianceLine] = useState(null);
  const [varianceSubmitting, setVarianceSubmitting] = useState(false);
  const [detailLine, setDetailLine] = useState(null);
  const [deciding, setDeciding] = useState(false);

  const setParam = useCallback((key, value) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value); else next.delete(key);
    router.replace(`/finance/budgets?${next.toString()}`, { scroll: false });
  }, [router, searchParams]);
  const setProjectId = (value) => setParam('projectId', value);

  useEffect(() => {
    if (!projectId && finance?.projects?.length) setProjectId(finance.projects[0].$id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finance, projectId]);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError('');
    try {
      const [lineResponse, summaryResponse, activityResponse] = await Promise.all([
        authenticatedFetch(`/api/finance/budget-lines?projectId=${encodeURIComponent(projectId)}`),
        authenticatedFetch(`/api/finance/summary?projectId=${encodeURIComponent(projectId)}`),
        authenticatedFetch(`/api/finance/activities?projectId=${encodeURIComponent(projectId)}`),
      ]);
      const [lineData, summaryData, activityData] = await Promise.all([lineResponse.json(), summaryResponse.json(), activityResponse.json()]);
      if (!lineResponse.ok) throw new Error(lineData.error || 'Activity budgets could not be loaded.');
      if (!summaryResponse.ok) throw new Error(summaryData.error || 'Budget performance could not be loaded.');
      if (!activityResponse.ok) throw new Error(activityData.error || 'Activities could not be loaded.');
      setBudgetLines(lineData.budgetLines || []);
      setPerformance(summaryData.activities || []);
      setActivities(activityData.activities || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => {
    const byId = new Map(performance.map((line) => [line.$id, line]));
    const merged = budgetLines.map((line) => ({ ...line, ...(byId.get(line.$id) || {}) }));
    return activityId ? merged.filter((line) => line.activityId === activityId) : merged;
  }, [budgetLines, performance, activityId]);
  const project = finance?.projects?.find((item) => item.$id === projectId);

  const save = async (payload) => {
    setSubmitting(true);
    try {
      const response = await authenticatedFetch(editing ? `/api/finance/budget-lines/${editing.$id}` : '/api/finance/budget-lines', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Budget could not be saved.');
      showToast('Activity budget submitted for review.', 'success');
      setShowForm(false);
      setEditing(null);
      await load();
    } catch (requestError) {
      showToast(requestError.message, 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  const saveVarianceExplanation = async (payload) => {
    setVarianceSubmitting(true);
    try {
      const response = await authenticatedFetch('/api/finance/variance-explanations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, submit: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Variance explanation could not be saved.');
      showToast('Variance explanation recorded for management review.', 'success');
      setVarianceLine(null);
    } catch (requestError) {
      showToast(requestError.message || 'Variance explanation could not be saved.', 'danger');
    } finally {
      setVarianceSubmitting(false);
    }
  };

  const validateProposal = async (action, comment) => {
    if ((action === 'return' || action === 'reject') && !comment.trim()) {
      showToast('A validation comment is required for this decision.', 'warning');
      return;
    }
    setDeciding(true);
    try {
      const response = await authenticatedFetch(`/api/finance/budget-lines/${detailLine.$id}/validate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, comment }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'The validation decision could not be saved.');
      showToast(action === 'validate' ? 'Budget proposal financially validated.' : action === 'return' ? 'Returned for correction.' : 'Rejected.', 'success');
      setDetailLine(null);
      await load();
    } catch (requestError) {
      showToast(requestError.message, 'danger');
    } finally {
      setDeciding(false);
    }
  };

  if (contextLoading) return <AppLayout user={user}><div className="text-center py-5"><Spinner animation="border" /></div></AppLayout>;
  if (contextError || !finance) return <AppLayout user={user}><Alert variant="danger" className="mt-4">{contextError}</Alert></AppLayout>;

  return (
    <FinanceWorkspace
      user={user}
      finance={finance}
      project={project}
      active="budgets"
      title="Activity Budgets"
      description="Preserve original approved allocations and derive transfers, revised budget, approved spend, balance, and utilisation."
      actions={<>{project?.canConfigureActivities && <Button variant="secondary" onClick={() => setShowStructure(true)}><i className="bi bi-diagram-3 me-1" />Activity codes</Button>}{finance.actor.canEdit && <Button onClick={() => { setEditing(null); setShowForm(true); }} disabled={!project}><i className="bi bi-plus-lg me-1" />New activity budget</Button>}</>}
    >
      <Toast toast={toast} onClose={hideToast} />
      <div className={financeStyles.filterBar}>
        <div className={financeStyles.filterWide}>
          <Form.Label className="small fw-semibold">Project</Form.Label>
          <Form.Select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
            {finance.projects.map((item) => <option key={item.$id} value={item.$id}>{item.code} · {item.name} ({item.budgetCurrency})</option>)}
          </Form.Select>
        </div>
        <div>
          <Form.Label className="small fw-semibold">Activity</Form.Label>
          <Form.Select value={activityId} onChange={(event) => setParam('activityId', event.target.value)}>
            <option value="">All activities</option>
            {activities.map((item) => <option key={item.$id} value={item.$id}>{item.activityCode ? `${item.activityCode} · ` : ''}{item.name}</option>)}
          </Form.Select>
        </div>
        <div className="d-flex align-items-end"><Button variant="secondary" onClick={load} disabled={loading}><i className="bi bi-arrow-clockwise me-1" />Refresh</Button></div>
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      <SectionCard
        title="Budget register"
        description={activityId ? 'Filtered to one activity — clear the Activity filter to see the full register.' : 'Approved rows are immutable; revised figures are derived from approved transfer and expense records.'}
        flush
      >
        {loading ? <div className="text-center py-5"><Spinner animation="border" /></div> : rows.length === 0 ? (
          <EmptyState icon="bi-wallet2" title="No activity budgets" text={finance.actor.canEdit ? 'Create the first allocation for this project.' : 'No budgets have been approved for this project.'} />
        ) : (
          <div className={financeStyles.tableWrap}>
            <Table hover className={financeStyles.dataTable}>
              <thead><tr><th>Activity</th><th>Status</th><th className="text-end">Original</th><th className="text-end">Transfers in</th><th className="text-end">Transfers out</th><th className="text-end">Revised</th><th className="text-end">Spend</th><th className="text-end">Available</th><th>Utilisation</th><th /></tr></thead>
              <tbody>{rows.map((line) => (
                <tr key={line.$id}>
                  <td><div className="fw-semibold">{line.activityName}</div><small className="text-muted">{line.activityCode || 'Uncoded activity'} · {line.currency}</small></td>
                  <td><StatusBadge status={line.status} /><ClearanceStatus record={line} kind="budgetLine" finance={finance} onChanged={load} notify={showToast} /></td>
                  <td className="text-end">{formatCurrency(line.originalAmount, line.currency)}</td>
                  <td className="text-end">{line.status === 'approved' ? formatCurrency(line.transfersIn, line.currency) : '—'}</td>
                  <td className="text-end">{line.status === 'approved' ? formatCurrency(line.transfersOut, line.currency) : '—'}</td>
                  <td className="text-end fw-semibold">{line.status === 'approved' ? formatCurrency(line.revisedBudget, line.currency) : '—'}</td>
                  <td className="text-end">{line.status === 'approved' ? formatCurrency(line.approvedSpend, line.currency) : '—'}</td>
                  <td className="text-end">{line.status === 'approved' ? <VarianceBadge variance={line.availableBalance} currency={line.currency} size="small" /> : '—'}</td>
                  <td>{line.status === 'approved' ? formatPercent(line.utilisation) : '—'}</td>
                  <td className="text-end d-flex gap-1 justify-content-end">
                    <Button size="sm" variant="secondary" onClick={() => setDetailLine(line)}>View</Button>
                    {finance.actor.canEdit && line.createdBy === finance.actor.accountId && ['draft', 'returned'].includes(line.status) && <Button size="sm" variant="secondary" onClick={() => { setEditing(line); setShowForm(true); }}>Edit</Button>}
                    {line.status === 'approved' && (finance.actor.canEdit || project?.isProjectHead) && (
                      <Button size="sm" variant="outline-secondary" onClick={() => setVarianceLine(line)}>Explain variance</Button>
                    )}
                  </td>
                </tr>
              ))}</tbody>
            </Table>
          </div>
        )}
      </SectionCard>

      <Modal show={showForm} onHide={() => { setShowForm(false); setEditing(null); }} size="lg" centered>
        <Modal.Header closeButton><Modal.Title>{editing ? 'Revise returned budget' : 'New activity budget'}</Modal.Title></Modal.Header>
        <Modal.Body>{project && <BudgetLineForm approvers={finance.approvers} project={project} activities={activities} initialValue={editing} submitting={submitting} onCancel={() => { setShowForm(false); setEditing(null); }} onSubmit={save} />}</Modal.Body>
      </Modal>
      <Modal show={showStructure} onHide={() => setShowStructure(false)} size="xl" centered scrollable>
        <Modal.Header closeButton><Modal.Title>Activity codes and hierarchy</Modal.Title></Modal.Header>
        <Modal.Body><ActivityStructureManager activities={activities} onChanged={load} notify={showToast} /></Modal.Body>
      </Modal>
      <Modal show={Boolean(detailLine)} onHide={() => setDetailLine(null)} size="lg" centered scrollable>
        <Modal.Header closeButton><Modal.Title>Activity Budget Proposal</Modal.Title></Modal.Header>
        <Modal.Body>{detailLine && (
          <BudgetProposalDetail
            line={detailLine}
            actor={finance.actor}
            onValidate={validateProposal}
            submitting={deciding}
            readOnlyReason={detailLine.status === 'submitted' && detailLine.createdBy === finance.actor.accountId ? 'You prepared this proposal — it must be validated and approved by someone else.' : null}
          />
        )}</Modal.Body>
      </Modal>
      <Modal show={Boolean(varianceLine)} onHide={() => setVarianceLine(null)} size="lg" centered scrollable>
        <Modal.Header closeButton><Modal.Title>Variance explanation</Modal.Title></Modal.Header>
        <Modal.Body>{project && varianceLine && (
          <VarianceExplanationForm
            approvers={finance.approvers}
            project={project}
            budgetLine={varianceLine}
            onSubmit={saveVarianceExplanation}
            onCancel={() => setVarianceLine(null)}
            submitting={varianceSubmitting}
          />
        )}</Modal.Body>
      </Modal>
    </FinanceWorkspace>
  );
}

export default function ActivityBudgetsPage() {
  return (
    <Suspense fallback={<AppLayout><div className="text-center py-5"><Spinner animation="border" /></div></AppLayout>}>
      <ActivityBudgetsContent />
    </Suspense>
  );
}
