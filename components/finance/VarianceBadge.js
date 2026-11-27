'use client';

import { Badge } from 'react-bootstrap';

function formatMoney(amount, currency) {
  const n = Number(amount || 0);
  return `${n < 0 ? '-' : ''}${currency || ''} ${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

/**
 * variance = plannedAmount - actualSpent.
 * Positive => underspent (good, funds still available).
 * Negative => overspent (needs attention / a reallocation in).
 */
export default function VarianceBadge({ variance, currency, size = 'normal' }) {
  const isOverspent = variance < 0;
  const fontSize = size === 'small' ? '0.7rem' : '0.8rem';

  const style = isOverspent
    ? { backgroundColor: 'rgba(220,38,38,0.12)', color: '#dc2626' }
    : { backgroundColor: 'rgba(13,148,136,0.12)', color: '#0d9488' };

  return (
    <Badge bg="" style={{ ...style, fontWeight: 600, fontSize, padding: '0.35em 0.6em' }}>
      <i className={`bi ${isOverspent ? 'bi-arrow-down-circle' : 'bi-arrow-up-circle'} me-1`}></i>
      {isOverspent ? 'Overspent' : 'Underspent'} {formatMoney(Math.abs(variance), currency)}
    </Badge>
  );
}
