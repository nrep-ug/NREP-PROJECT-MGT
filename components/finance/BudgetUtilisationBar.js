'use client';

import financeStyles from './FinanceWorkspace.module.css';
import { formatPercent } from '@/lib/financeFormat';

/**
 * Single utilisation bar for a project or activity — same visual language as
 * the per-activity rows, used once at the top of a Finance overview so the
 * headline number ("Budget Utilisation 46%") is never just text.
 */
export default function BudgetUtilisationBar({ percent = 0, isOverBudget = false }) {
  const value = Math.min(Math.max(Number(percent) || 0, 0), 100);
  const progressClass = isOverBudget
    ? financeStyles.progressDanger
    : Number(percent) >= 90
      ? financeStyles.progressWarning
      : '';
  return (
    <div className="d-flex align-items-center gap-3">
      <div className={`${financeStyles.progressTrack} flex-grow-1`} style={{ height: 10 }}>
        <div className={`${financeStyles.progressFill} ${progressClass}`} style={{ width: `${value}%` }} />
      </div>
      <strong style={{ minWidth: '3.5rem', textAlign: 'right' }}>{formatPercent(percent)}</strong>
    </div>
  );
}
