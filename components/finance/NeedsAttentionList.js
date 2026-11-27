'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Spinner } from 'react-bootstrap';
import { authenticatedFetch } from '@/lib/apiClient';
import { formatCurrency } from '@/lib/financeFormat';
import EmptyState from '@/components/ui/EmptyState';
import uiStyles from '@/components/ui/WorkspaceUI.module.css';

const SEVERITY_TONE = {
  critical: 'statusDanger',
  high: 'statusDanger',
  warning: 'statusWarning',
  medium: 'statusWarning',
  info: 'statusInfo',
  low: 'statusNeutral',
};

/**
 * Compact "Needs Attention" list backed by the real exceptions engine
 * (/api/finance/exceptions) — nothing here is invented; every row drills
 * into its underlying record. Used on the project Finance tab, the full
 * per-project view, and the global overview so the signal is identical
 * everywhere it appears.
 */
export default function NeedsAttentionList({ projectId = null, limit = 5 }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
    authenticatedFetch(`/api/finance/exceptions${query}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Needs Attention could not be loaded.');
        if (!cancelled) setItems(data.items || []);
      })
      .catch((requestError) => { if (!cancelled) setError(requestError.message); })
      .finally(() => {});
    return () => { cancelled = true; };
  }, [projectId]);

  if (error) return <div className="text-muted small">{error}</div>;
  if (items === null) return <div className="text-center py-3"><Spinner animation="border" size="sm" /></div>;
  if (items.length === 0) {
    return <EmptyState icon="bi-check2-circle" title="Nothing needs attention" text="No open Finance exceptions right now." />;
  }

  return (
    <div className="d-flex flex-column gap-2">
      {items.slice(0, limit).map((item) => (
        <Link
          key={item.$id}
          href={item.href}
          className="text-reset text-decoration-none d-flex justify-content-between align-items-center gap-3 py-2 border-bottom"
        >
          <div className="min-w-0">
            <div className="d-flex align-items-center gap-2 mb-1">
              <span className={`${uiStyles.statusBadge} ${uiStyles[SEVERITY_TONE[item.severity] || 'statusNeutral']}`}>
                {item.severity}
              </span>
              <strong className="text-truncate">{item.title}</strong>
            </div>
            {(item.projectName || item.activityName) && (
              <small className="text-muted">
                {item.projectCode ? `${item.projectCode} · ` : ''}
                {item.activityCode ? `${item.activityCode} — ` : ''}
                {item.activityName || item.projectName}
              </small>
            )}
          </div>
          {item.amount !== undefined && item.currency && (
            <span className="fw-semibold text-nowrap">{formatCurrency(item.amount, item.currency)}</span>
          )}
        </Link>
      ))}
      {items.length > limit && (
        <Link href={projectId ? `/finance/needs-attention?projectId=${projectId}` : '/finance/needs-attention'} className="small">
          View all {items.length} items <i className="bi bi-arrow-right" />
        </Link>
      )}
    </div>
  );
}
