'use client';

import Link from 'next/link';
import { Table } from 'react-bootstrap';
import EmptyState from '@/components/ui/EmptyState';
import financeStyles from './FinanceWorkspace.module.css';
import { formatCurrency, formatPercent } from '@/lib/financeFormat';

/**
 * Shared "Budget by Activity" table — Activity / Budget / Actual / Committed /
 * Available — used on the project Finance tab, the full per-project Finance
 * view, and the org-wide overview so every entry point reads identically.
 * Activity code/name open the Finance-native activity detail (expenses,
 * commitments, reallocations, variance, audit — all Finance-first); a small
 * secondary icon links out to the Activity Schedule for implementation context.
 */
export default function ActivityBudgetTable({ activities = [], projectId = null, emptyText = 'No approved activity budgets yet.' }) {
  if (activities.length === 0) {
    return <EmptyState icon="bi-wallet2" title="No activity budgets" text={emptyText} />;
  }
  return (
    <div className={financeStyles.tableWrap}>
      <Table hover className={financeStyles.dataTable}>
        <thead>
          <tr>
            <th>Activity</th>
            <th className="text-end">Budget</th>
            <th className="text-end">Actual</th>
            <th className="text-end">Committed</th>
            <th className="text-end">Available</th>
            <th>Utilisation</th>
          </tr>
        </thead>
        <tbody>
          {activities.map((activity) => {
            const currency = activity.currency;
            const target = projectId || activity.projectId;
            const label = (
              <>
                <div className="fw-semibold">{activity.activityCode || 'Uncoded activity'}</div>
                <small className="text-muted">{activity.activityName}</small>
              </>
            );
            return (
              <tr key={activity.$id}>
                <td>
                  <div className="d-flex align-items-center gap-2">
                    {target && activity.activityId ? (
                      <Link href={`/finance/${target}/activities/${activity.activityId}`} className="text-reset text-decoration-none">{label}</Link>
                    ) : label}
                    {target && activity.activityId && (
                      <Link
                        href={`/projects/${target}?tab=milestones`}
                        className="text-muted"
                        title="Open in Activity Schedule"
                        aria-label="Open in Activity Schedule"
                      >
                        <i className="bi bi-box-arrow-up-right" style={{ fontSize: '0.75rem' }} />
                      </Link>
                    )}
                  </div>
                </td>
                <td className="text-end">{formatCurrency(activity.revisedBudget, currency)}</td>
                <td className="text-end">{formatCurrency(activity.actualSpend ?? activity.approvedSpend, currency)}</td>
                <td className="text-end">{formatCurrency(activity.committedAmount || 0, currency)}</td>
                <td className="text-end fw-semibold">{formatCurrency(activity.availableBalance, currency)}</td>
                <td>{formatPercent(activity.utilisation)}</td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}
