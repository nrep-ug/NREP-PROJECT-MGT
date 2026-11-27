'use client';

import Link from 'next/link';
import { Spinner } from 'react-bootstrap';
import { useQuery } from '@tanstack/react-query';
import { authenticatedFetch } from '@/lib/apiClient';
import { formatCurrency, formatPercent } from '@/lib/financeFormat';
import styles from './ManagerFinanceSnapshot.module.css';

export default function ManagerFinanceSnapshot({ user }) {
  const visible = Boolean(user?.isManager || user?.isAdmin || user?.isFinance);
  const query = useQuery({
    queryKey: ['finance', 'summary', 'org'],
    enabled: visible,
    // The Appwrite server is occasionally slow; retry before showing an error.
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const response = await authenticatedFetch('/api/finance/summary');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Finance snapshot is unavailable.');
      return data;
    },
  });
  const summary = query.data;
  const loading = query.isLoading;
  const error = query.isError ? (query.error?.message === 'Failed to fetch'
    ? 'The server was slow to answer.'
    : query.error?.message) : '';
  const errorBox = (
    <div className="d-flex align-items-center gap-2 small text-muted py-2" role="status">
      <i className="bi bi-wifi-off" aria-hidden="true" />
      <span>Financial figures couldn’t load. {error}</span>
      <button type="button" className="btn btn-link btn-sm p-0" onClick={() => query.refetch()} disabled={query.isFetching}>
        {query.isFetching ? 'Retrying…' : 'Retry'}
      </button>
    </div>
  );

  if (!visible) return null;
  const waiting = (summary?.exceptions || 0) + (summary?.pendingReview || 0);
  return (
    <section className="mb-4" aria-labelledby="manager-finance-title">
      <div className="d-flex justify-content-between align-items-end gap-3 mb-3">
        <div><h2 id="manager-finance-title" className="h5 fw-bold mb-1">Financial overview</h2><p className="text-muted small mb-0">Totals stay separated by currency.</p></div>
        <Link href="/finance" className={styles.viewButton}>View Finance <i className="bi bi-arrow-right" /></Link>
      </div>
      {loading ? <div className="text-center py-3"><Spinner animation="border" size="sm" /></div> : error ? errorBox : summary?.currencyGroups?.length ? (
        <div className={styles.grid}>
          {summary.currencyGroups.map((group) => {
            const used = Math.max(0, Math.min(100, Number(group.utilisation) || 0));
            return (
              <div className={styles.money} key={group.currency}>
                <div className={styles.moneyHead}>
                  <span className={styles.currency}>{group.currency}</span>
                  <span className={styles.utilised}>{formatPercent(group.utilisation)} of budget used</span>
                </div>
                <div>
                  <div className={styles.heroLabel}>Available to spend</div>
                  <div className={styles.heroValue}>{formatCurrency(group.availableBalance, group.currency)}</div>
                </div>
                <div className={styles.bar} role="img" aria-label={`${formatPercent(group.utilisation)} of budget used`}>
                  <div className={`${styles.barFill} ${used >= 90 ? styles.barFillWarn : ''}`} style={{ width: `${used}%` }} />
                </div>
                <div className={styles.figures}>
                  <div className={styles.figure}><span className={styles.figureLabel}>Budget</span><span className={styles.figureValue}>{formatCurrency(group.revisedBudget, group.currency)}</span></div>
                  <div className={styles.figure}><span className={styles.figureLabel}>Spent</span><span className={styles.figureValue}>{formatCurrency(group.actualSpend ?? group.approvedSpend, group.currency)}</span></div>
                  <div className={styles.figure}><span className={styles.figureLabel}>Committed</span><span className={styles.figureValue}>{formatCurrency(group.committedAmount || 0, group.currency)}</span></div>
                </div>
              </div>
            );
          })}
          <div className={`${styles.attention} ${waiting === 0 ? styles.attentionClear : ''}`}>
            <div className={styles.attentionHead}>
              <span className={styles.attentionIcon}><i className={`bi ${waiting === 0 ? 'bi-check2-circle' : 'bi-exclamation-triangle'}`} /></span>
              {waiting === 0 ? 'All clear' : 'Needs attention'}
            </div>
            <Link href="/finance/needs-attention" className={styles.attentionRow}>
              <span className={styles.attentionCount}>{summary.exceptions}</span>
              <span className={styles.attentionText}>{summary.exceptions === 1 ? 'project or activity needs' : 'projects or activities need'} attention</span>
              <i className="bi bi-chevron-right" />
            </Link>
            <Link href="/finance/review-queue" className={styles.attentionRow}>
              <span className={styles.attentionCount}>{summary.pendingReview}</span>
              <span className={styles.attentionText}>{summary.pendingReview === 1 ? 'record is' : 'records are'} waiting for approval</span>
              <i className="bi bi-chevron-right" />
            </Link>
          </div>
        </div>
      ) : <div className="border rounded p-3 text-muted small">No approved Finance data yet.</div>}
    </section>
  );
}
