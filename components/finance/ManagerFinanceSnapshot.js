'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Spinner } from 'react-bootstrap';
import { authenticatedFetch } from '@/lib/apiClient';
import { formatCurrency, formatPercent } from '@/lib/financeFormat';
import financeStyles from './FinanceWorkspace.module.css';

export default function ManagerFinanceSnapshot({ user }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const visible = user?.isManager || user?.isAdmin || user?.isFinance;

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    authenticatedFetch('/api/finance/summary')
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Finance snapshot is unavailable.');
        if (!cancelled) setSummary(data);
      })
      .catch((requestError) => { if (!cancelled) setError(requestError.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [visible]);

  if (!visible) return null;
  return (
    <section className="mb-4" aria-labelledby="manager-finance-title">
      <div className="d-flex justify-content-between align-items-end gap-3 mb-3">
        <div><h2 id="manager-finance-title" className="h5 fw-bold mb-1">Financial overview</h2><p className="text-muted small mb-0">Read-only; totals stay separated by currency.</p></div>
        <Link href="/finance" className="btn btn-sm btn-secondary">View Finance <i className="bi bi-arrow-right ms-1" /></Link>
      </div>
      {loading ? <div className="text-center py-3"><Spinner animation="border" size="sm" /></div> : error ? <Alert variant="warning" className="small">{error}</Alert> : summary?.currencyGroups?.length ? (
        <div className={financeStyles.currencyStrip}>
          {summary.currencyGroups.map((group) => <div className={financeStyles.currencyCard} key={group.currency}>
            <div className="d-flex justify-content-between"><span className={financeStyles.currencyCode}>{group.currency}</span><small className="text-muted">{formatPercent(group.utilisation)} utilised</small></div>
            <div className={financeStyles.currencyGrid}>
              <div><div className={financeStyles.currencyLabel}>Budget</div><div className={financeStyles.currencyValue}>{formatCurrency(group.revisedBudget, group.currency)}</div></div>
              <div><div className={financeStyles.currencyLabel}>Spent</div><div className={financeStyles.currencyValue}>{formatCurrency(group.actualSpend ?? group.approvedSpend, group.currency)}</div></div>
              <div><div className={financeStyles.currencyLabel}>Committed</div><div className={financeStyles.currencyValue}>{formatCurrency(group.committedAmount || 0, group.currency)}</div></div>
              <div><div className={financeStyles.currencyLabel}>Available</div><div className={financeStyles.currencyValue}>{formatCurrency(group.availableBalance, group.currency)}</div></div>
            </div>
          </div>)}
          <Link href="/finance/needs-attention" className={`${financeStyles.currencyCard} text-reset text-decoration-none`}>
            <div className={financeStyles.currencyCode}>Needs attention</div>
            <div className="mt-3"><strong>{summary.exceptions}</strong> projects/activities needing attention</div>
            <div className="mt-2"><strong>{summary.pendingReview}</strong> Finance records awaiting review</div>
          </Link>
        </div>
      ) : <div className="border rounded p-3 text-muted small">No approved Finance data yet.</div>}
    </section>
  );
}
