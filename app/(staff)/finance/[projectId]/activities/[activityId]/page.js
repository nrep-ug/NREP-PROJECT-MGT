'use client';

import { Suspense, use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Alert, Form, Spinner, Table, Tab, Tabs } from 'react-bootstrap';
import AppLayout from '@/components/AppLayout';
import AuditTimeline from '@/components/finance/AuditTimeline';
import FinanceWorkspace from '@/components/finance/FinanceWorkspace';
import financeStyles from '@/components/finance/FinanceWorkspace.module.css';
import EmptyState from '@/components/ui/EmptyState';
import MetricCard from '@/components/ui/MetricCard';
import SectionCard from '@/components/ui/SectionCard';
import StatusBadge from '@/components/ui/StatusBadge';
import { useFinanceContext } from '@/hooks/useFinanceContext';
import { authenticatedFetch } from '@/lib/apiClient';
import { formatCurrency, formatFinanceDate, formatPercent, titleCase } from '@/lib/financeFormat';

/**
 * Finance-native activity detail — Project → Finance → Budget by Activity →
 * [activity]. This is the Finance answer to "what makes up this activity's
 * numbers", not a redirect to the Activity Schedule. Every figure here comes
 * from the same /api/finance/activities/[id]/detail response, which itself
 * reuses calculateBudgetPerformance — nothing is recomputed in the browser.
 */
function ActivityFinanceDetailContent({ params }) {
  const { projectId, activityId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, finance, loading: contextLoading, error: contextError } = useFinanceContext();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const year = Number(searchParams.get('year')) || new Date().getFullYear();
  const quarter = searchParams.get('quarter') || '';

  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value); else next.delete(key);
    router.replace(`/finance/${projectId}/activities/${activityId}?${next.toString()}`, { scroll: false });
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({ year: String(year) });
      if (quarter) query.set('quarter', quarter);
      const response = await authenticatedFetch(`/api/finance/activities/${activityId}/detail?${query}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Activity Finance detail could not be loaded.');
      setDetail(data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [activityId, year, quarter]);

  useEffect(() => { load(); }, [load]);

  if (contextLoading) return <AppLayout user={user}><div className="text-center py-5"><Spinner animation="border" /></div></AppLayout>;
  if (contextError || !finance) return <AppLayout user={user}><Alert variant="danger" className="mt-4">{contextError}</Alert></AppLayout>;

  const line = detail?.budgetLine;
  const currency = line?.currency || detail?.project?.budgetCurrency;

  return (
    <FinanceWorkspace
      user={user}
      finance={finance}
      active="budgets"
      title={detail?.activity ? `${detail.activity.activityCode ? `${detail.activity.activityCode} · ` : ''}${detail.activity.name}` : 'Activity Finance'}
      description={detail?.project?.name}
      project={{ $id: projectId, name: detail?.project?.name || 'Project', code: detail?.project?.code }}
      actions={<Link href={`/projects/${projectId}?tab=milestones`} className="btn btn-outline-secondary"><i className="bi bi-flag me-1" />Activity Schedule</Link>}
    >
      {error && <Alert variant="danger">{error}</Alert>}
      {loading || !detail ? <div className="text-center py-5"><Spinner animation="border" /></div> : !line ? (
        <SectionCard title="No approved budget yet">
          {detail.proposedBudgetLine ? (
            <div className="d-flex align-items-center gap-3">
              <StatusBadge status={detail.proposedBudgetLine.status} />
              <span>A budget proposal exists for this activity but is not yet approved. Financial detail will appear here once it is.</span>
            </div>
          ) : <EmptyState icon="bi-wallet2" title="No budget proposed" text="No one has proposed a budget for this activity yet." />}
        </SectionCard>
      ) : (
        <>
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
            <div className="col-sm-6 col-xl-3"><MetricCard label="Original budget" value={formatCurrency(line.originalBudget, currency)} icon="bi-bank" /></div>
            <div className="col-sm-6 col-xl-3"><MetricCard label="Transfers in / out" value={`+${formatCurrency(line.transfersIn, currency)} / -${formatCurrency(line.transfersOut, currency)}`} icon="bi-arrow-left-right" /></div>
            <div className="col-sm-6 col-xl-3"><MetricCard label="Revised budget" value={formatCurrency(line.revisedBudget, currency)} icon="bi-wallet2" /></div>
            <div className="col-sm-6 col-xl-3"><MetricCard label="Utilisation" value={formatPercent(line.utilisation)} icon="bi-graph-up" /></div>
          </div>
          <div className="row g-3 mb-3">
            <div className="col-sm-6 col-xl-3"><MetricCard label="Actual spend (cumulative)" value={formatCurrency(line.actualSpend, currency)} icon="bi-receipt" /></div>
            <div className="col-sm-6 col-xl-3"><MetricCard label="Outstanding commitments" value={formatCurrency(line.committedAmount || 0, currency)} icon="bi-journal-check" /></div>
            <div className="col-sm-6 col-xl-3"><MetricCard label="Available balance" value={formatCurrency(line.availableBalance, currency)} icon="bi-pie-chart" /></div>
            <div className="col-sm-6 col-xl-3"><MetricCard label="Variance" value={formatCurrency(line.variance, currency)} icon={line.isOverBudget ? 'bi-exclamation-triangle' : 'bi-check2-circle'} /></div>
          </div>
          {detail.period.applicable && (
            <Alert variant="info" className="d-flex justify-content-between align-items-center">
              <span>Q{detail.period.quarter} {detail.period.year} spend (not part of the cumulative Actual Spend above)</span>
              <strong>{formatCurrency(detail.period.spend, currency)}</strong>
            </Alert>
          )}

          <Tabs defaultActiveKey="expenses" className="mb-3">
            <Tab eventKey="expenses" title={`Expenses (${detail.expenditures.length})`}>
              {detail.expenditures.length === 0 ? <EmptyState icon="bi-receipt" title="No expenses recorded" /> : (
                <div className={financeStyles.tableWrap}>
                  <Table hover className={financeStyles.dataTable}>
                    <thead><tr><th>Date</th><th>Description</th><th>Payee</th><th>Responsible</th><th className="text-end">Amount</th><th>Status</th></tr></thead>
                    <tbody>{detail.expenditures.map((expense) => (
                      <tr key={expense.$id}>
                        <td>{formatFinanceDate(expense.expenseDate)}</td>
                        <td className="text-truncate" style={{ maxWidth: 220 }}>{expense.description}</td>
                        <td>{expense.payee}</td>
                        <td>{expense.responsibleStaffName}</td>
                        <td className="text-end">{formatCurrency(expense.amount, expense.currency)}</td>
                        <td><StatusBadge status={expense.status} /></td>
                      </tr>
                    ))}</tbody>
                  </Table>
                </div>
              )}
            </Tab>
            <Tab eventKey="commitments" title={`Commitments (${detail.commitments.length})`}>
              {detail.commitments.length === 0 ? <EmptyState icon="bi-journal-check" title="No commitments" /> : (
                <div className={financeStyles.tableWrap}>
                  <Table hover className={financeStyles.dataTable}>
                    <thead><tr><th>Vendor</th><th>Committed</th><th>Expected</th><th className="text-end">Amount</th><th>Status</th></tr></thead>
                    <tbody>{detail.commitments.map((item) => (
                      <tr key={item.$id}>
                        <td>{item.vendor}</td>
                        <td>{formatFinanceDate(item.commitmentDate)}</td>
                        <td>{formatFinanceDate(item.expectedDate)}</td>
                        <td className="text-end">{formatCurrency(item.amount, item.currency)}</td>
                        <td><StatusBadge status={item.status} /></td>
                      </tr>
                    ))}</tbody>
                  </Table>
                </div>
              )}
            </Tab>
            <Tab eventKey="reallocations" title={`Reallocations (${detail.reallocations.length})`}>
              {detail.reallocations.length === 0 ? <EmptyState icon="bi-arrow-left-right" title="No reallocations" /> : (
                <div className="d-flex flex-column gap-2">
                  {detail.reallocations.map((item) => (
                    <div className="d-flex justify-content-between align-items-center py-2 border-bottom" key={item.$id}>
                      <div>
                        <strong>{item.fromActivityCode || item.fromActivityName} → {item.toActivityCode || item.toActivityName}</strong>
                        <div className="small text-muted">{item.reason}</div>
                      </div>
                      <div className="text-end">
                        <div className="fw-semibold">{formatCurrency(item.amount, item.currency)}</div>
                        <StatusBadge status={item.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Tab>
            <Tab eventKey="variance" title={`Variance (${detail.varianceExplanations.length})`}>
              {detail.varianceExplanations.length === 0 ? <EmptyState icon="bi-file-text" title="No variance explanations recorded" /> : (
                <div className="d-flex flex-column gap-3">
                  {detail.varianceExplanations.map((item) => (
                    <div className="border-bottom pb-3" key={item.$id}>
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <strong>{item.periodKey}</strong>
                        <StatusBadge status={item.status} />
                      </div>
                      <div className="small text-muted mb-1">Variance {formatCurrency(item.varianceAmount, item.currency)} ({formatPercent(item.variancePercent)}) against a {formatPercent(item.materialityThresholdPercent)} materiality threshold</div>
                      <p className="mb-0">{item.explanation}</p>
                    </div>
                  ))}
                </div>
              )}
            </Tab>
            <Tab eventKey="audit" title="Audit history">
              <AuditTimeline record={line} title="" emptyText="No audit history is available for this activity budget yet." />
            </Tab>
          </Tabs>
        </>
      )}
    </FinanceWorkspace>
  );
}

export default function ActivityFinanceDetailPage({ params }) {
  return (
    <Suspense fallback={<AppLayout><div className="text-center py-5"><Spinner animation="border" /></div></AppLayout>}>
      <ActivityFinanceDetailContent params={params} />
    </Suspense>
  );
}
