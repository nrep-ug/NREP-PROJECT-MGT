'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Spinner, Table } from 'react-bootstrap';
import { authenticatedFetch } from '@/lib/apiClient';
import { formatCurrency, formatFinanceDate, titleCase } from '@/lib/financeFormat';
import ActivityBudgetTable from '@/components/finance/ActivityBudgetTable';
import BudgetUtilisationBar from '@/components/finance/BudgetUtilisationBar';
import ClickableMetricCard from '@/components/finance/ClickableMetricCard';
import NeedsAttentionList from '@/components/finance/NeedsAttentionList';
import EmptyState from '@/components/ui/EmptyState';
import SectionCard from '@/components/ui/SectionCard';
import financeStyles from '@/components/finance/FinanceWorkspace.module.css';

/**
 * Finance, as seen from inside a project — Projects → [project] → Finance.
 * projectId is inherited from the project already on screen; nothing here
 * asks the user to pick a project again. Reads the same /api/finance/summary
 * that every other Finance entry point reads, so figures never diverge.
 */
export default function ProjectFinanceSummary({ project }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    authenticatedFetch(`/api/finance/summary?projectId=${encodeURIComponent(project.$id)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Project Finance could not be loaded.');
        if (!cancelled) setSummary(data);
      })
      .catch((requestError) => { if (!cancelled) setError(requestError.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [project.$id]);

  if (loading) return <div className="text-center py-5"><Spinner animation="border" /></div>;
  if (error) return <Alert variant="warning">{error}</Alert>;
  const { totals } = summary;
  const currency = totals.currency || project.budgetCurrency;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
        <h2 className="h5 fw-bold mb-0">Finance</h2>
        <Link href={`/finance/${project.$id}`} className="btn btn-secondary btn-sm">
          Open full Finance view <i className="bi bi-arrow-right ms-1" />
        </Link>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-sm-6 col-xl-3"><ClickableMetricCard href={`/finance/budgets?projectId=${project.$id}`} label="Approved budget" value={formatCurrency(totals.revisedBudget, currency)} icon="bi-bank" /></div>
        <div className="col-sm-6 col-xl-3"><ClickableMetricCard href={`/finance/expenses?projectId=${project.$id}&status=approved`} label="Actual spend" value={formatCurrency(totals.actualSpend ?? totals.approvedSpend, currency)} icon="bi-receipt" /></div>
        <div className="col-sm-6 col-xl-3"><ClickableMetricCard href={`/finance/commitments?projectId=${project.$id}`} label="Committed" value={formatCurrency(totals.committedAmount || 0, currency)} icon="bi-journal-check" /></div>
        <div className="col-sm-6 col-xl-3"><ClickableMetricCard href={`/finance/budgets?projectId=${project.$id}`} label="Available" value={formatCurrency(totals.availableBalance, currency)} icon="bi-pie-chart" /></div>
      </div>

      <SectionCard title="Budget utilisation" className="mb-3">
        <BudgetUtilisationBar percent={totals.utilisation} isOverBudget={totals.availableBalance < 0} />
      </SectionCard>

      <SectionCard title="Budget by activity" flush className="mb-3">
        <ActivityBudgetTable activities={summary.activities} projectId={project.$id} />
      </SectionCard>

      <div className="row g-3">
        <div className="col-xl-7">
          <SectionCard title="Recent expenses" flush>
            {summary.recentTransactions?.length ? (
              <div className={financeStyles.tableWrap}>
                <Table className={financeStyles.dataTable}>
                  <thead><tr><th>Date</th><th>Activity</th><th>Description</th><th className="text-end">Amount</th><th>Status</th></tr></thead>
                  <tbody>{summary.recentTransactions.slice(0, 6).map((expense) => (
                    <tr key={expense.$id}>
                      <td>{formatFinanceDate(expense.expenseDate)}</td>
                      <td>{expense.activityCode || expense.activityName}</td>
                      <td className="text-truncate" style={{ maxWidth: 220 }}>{expense.description}</td>
                      <td className="text-end">{formatCurrency(expense.amount, expense.currency)}</td>
                      <td>{titleCase(expense.status)}</td>
                    </tr>
                  ))}</tbody>
                </Table>
              </div>
            ) : <EmptyState title="No recorded expenses" icon="bi-receipt" />}
          </SectionCard>
        </div>
        <div className="col-xl-5">
          <SectionCard title="Recent reallocations" className="mb-3">
            {summary.recentReallocations?.length ? summary.recentReallocations.slice(0, 4).map((item) => (
              <div className="py-2 border-bottom" key={item.$id}>
                <div className="d-flex justify-content-between gap-2">
                  <strong>{item.fromActivityCode || item.fromActivityName} → {item.toActivityCode || item.toActivityName}</strong>
                  <strong>{formatCurrency(item.amount, item.currency)}</strong>
                </div>
                <small className="text-muted">{item.reason}</small>
              </div>
            )) : <EmptyState title="No approved reallocations" icon="bi-arrow-left-right" />}
          </SectionCard>
          <SectionCard title="Needs attention">
            <NeedsAttentionList projectId={project.$id} limit={4} />
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
