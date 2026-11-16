'use client';

import { Suspense, use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Alert, Form, Spinner, Table } from 'react-bootstrap';
import AppLayout from '@/components/AppLayout';
import ActivityBudgetTable from '@/components/finance/ActivityBudgetTable';
import BudgetUtilisationBar from '@/components/finance/BudgetUtilisationBar';
import ClickableMetricCard from '@/components/finance/ClickableMetricCard';
import NeedsAttentionList from '@/components/finance/NeedsAttentionList';
import FinanceWorkspace from '@/components/finance/FinanceWorkspace';
import financeStyles from '@/components/finance/FinanceWorkspace.module.css';
import EmptyState from '@/components/ui/EmptyState';
import SectionCard from '@/components/ui/SectionCard';
import { useFinanceContext } from '@/hooks/useFinanceContext';
import { authenticatedFetch } from '@/lib/apiClient';
import { formatCurrency, formatFinanceDate } from '@/lib/financeFormat';

function ProjectFinanceContent({ params }) {
  const { projectId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, finance, loading: contextLoading, error: contextError } = useFinanceContext();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const year = Number(searchParams.get('year')) || new Date().getFullYear();
  const quarter = searchParams.get('quarter') || '';

  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value); else next.delete(key);
    router.replace(`/finance/${projectId}?${next.toString()}`, { scroll: false });
  };

  const load = useCallback(async () => {
    if (!finance) return;
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({ year: String(year) });
      if (quarter) query.set('quarter', quarter);
      const response = await authenticatedFetch(`/api/finance/summary?projectId=${encodeURIComponent(projectId)}&${query}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Project Finance could not be loaded.');
      setSummary(data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [finance, projectId, year, quarter]);
  useEffect(() => { load(); }, [load]);

  if (contextLoading) return <AppLayout user={user}><div className="text-center py-5"><Spinner animation="border" /></div></AppLayout>;
  if (contextError || !finance) return <AppLayout user={user}><Alert variant="danger" className="mt-4">{contextError}</Alert></AppLayout>;
  const currency = summary?.totals?.currency || summary?.project?.budgetCurrency;
  const totals = summary?.totals;
  return (
    <FinanceWorkspace
      user={user}
      finance={finance}
      active="project"
      project={summary?.project ? { $id: projectId, name: summary.project.name, code: summary.project.code } : undefined}
      back={{ href: '/finance', label: 'Back to Finance overview (all projects)' }}
      title={summary?.project?.name || 'Project Finance'}
      description={summary?.project?.code}
      actions={<Link href={`/projects/${projectId}`} className="btn btn-secondary"><i className="bi bi-folder2-open me-1" />Project detail</Link>}
    >
      {error && <Alert variant="danger">{error}</Alert>}
      {loading || !summary ? <div className="text-center py-5"><Spinner animation="border" /></div> : <>
        <div className={financeStyles.filterBar} style={{ gridTemplateColumns: 'repeat(3, minmax(120px, 1fr))' }}>
          <div><Form.Label className="small fw-semibold">Financial year</Form.Label><Form.Control type="number" value={year} onChange={(event) => setParam('year', event.target.value)} /></div>
          <div>
            <Form.Label className="small fw-semibold">Quarter (period spend)</Form.Label>
            <Form.Select value={quarter} onChange={(event) => setParam('quarter', event.target.value)}>
              <option value="">Cumulative (all quarters)</option>
              {[1, 2, 3, 4].map((value) => <option key={value} value={value}>Q{value}</option>)}
            </Form.Select>
          </div>
        </div>

        <div className="row g-3 mb-3">
          <div className="col-sm-6 col-xl-3"><ClickableMetricCard href={`/finance/budgets?projectId=${projectId}`} label="Approved budget" value={formatCurrency(totals.revisedBudget, currency)} icon="bi-bank" /></div>
          <div className="col-sm-6 col-xl-3"><ClickableMetricCard href={`/finance/expenses?projectId=${projectId}&status=approved`} label="Actual spend" value={formatCurrency(totals.actualSpend ?? totals.approvedSpend, currency)} icon="bi-receipt" /></div>
          <div className="col-sm-6 col-xl-3"><ClickableMetricCard href={`/finance/commitments?projectId=${projectId}`} label="Committed" value={formatCurrency(totals.committedAmount || 0, currency)} icon="bi-journal-check" /></div>
          <div className="col-sm-6 col-xl-3"><ClickableMetricCard href={`/finance/budgets?projectId=${projectId}`} label="Available" value={formatCurrency(totals.availableBalance, currency)} icon="bi-pie-chart" /></div>
        </div>

        {summary.period?.applicable && (
          <Alert variant="info" className="d-flex justify-content-between align-items-center">
            <span>Q{summary.period.quarter} {summary.period.year} spend for this project (separate from the cumulative Actual Spend above)</span>
            <strong>{formatCurrency(summary.period.spend, currency)}</strong>
          </Alert>
        )}

        <SectionCard title="Budget utilisation" className="mb-3">
          <BudgetUtilisationBar percent={totals.utilisation} isOverBudget={totals.availableBalance < 0} />
        </SectionCard>

        <SectionCard title="Budget by activity" flush className="mb-3">
          <ActivityBudgetTable activities={summary.activities} projectId={projectId} />
        </SectionCard>

        <div className="row g-4">
          <div className="col-xl-7">
            <SectionCard title={summary.period?.applicable ? `Expenses in Q${summary.period.quarter} ${summary.period.year}` : 'Recent expenses'} flush>
              {(() => {
                const rows = summary.period?.applicable ? summary.period.transactions : summary.recentTransactions;
                return rows.length ? (
                  <div className={financeStyles.tableWrap}>
                    <Table className={financeStyles.dataTable}>
                      <thead><tr><th>Date</th><th>Activity</th><th>Payee</th><th className="text-end">Amount</th><th>Status</th></tr></thead>
                      <tbody>{rows.map((expense) => <tr key={expense.$id}><td>{formatFinanceDate(expense.expenseDate)}</td><td>{expense.activityCode || expense.activityName}</td><td>{expense.payee}</td><td className="text-end">{formatCurrency(expense.amount, expense.currency)}</td><td>{expense.status}</td></tr>)}</tbody>
                    </Table>
                  </div>
                ) : <EmptyState title="No approved expenses" />;
              })()}
            </SectionCard>
          </div>
          <div className="col-xl-5">
            <SectionCard title="Recent reallocations" className="mb-3">{summary.recentReallocations.length ? summary.recentReallocations.map((item) => <div className="py-2 border-bottom" key={item.$id}><div className="d-flex justify-content-between gap-2"><strong>{item.fromActivityCode || item.fromActivityName} → {item.toActivityCode || item.toActivityName}</strong><strong>{formatCurrency(item.amount, item.currency)}</strong></div><small className="text-muted">{item.reason}</small></div>) : <EmptyState title="No approved reallocations" />}</SectionCard>
            <SectionCard title="Needs attention"><NeedsAttentionList projectId={projectId} limit={5} /></SectionCard>
          </div>
        </div>
      </>}
    </FinanceWorkspace>
  );
}

export default function ProjectFinancePage({ params }) {
  return (
    <Suspense fallback={<AppLayout><div className="text-center py-5"><Spinner animation="border" /></div></AppLayout>}>
      <ProjectFinanceContent params={params} />
    </Suspense>
  );
}
