'use client';

import Link from 'next/link';
import AppLayout from '@/components/AppLayout';
import PageHeader from '@/components/ui/PageHeader';
import styles from './FinanceWorkspace.module.css';
import { titleCase } from '@/lib/financeFormat';

const NAV_ITEMS = [
  { key: 'overview', href: '/finance', label: 'Overview', icon: 'bi-grid-1x2' },
  { key: 'budgets', href: '/finance/budgets', label: 'Activity Budgets', icon: 'bi-wallet2' },
  { key: 'expenses', href: '/finance/expenses', label: 'Expenses', icon: 'bi-receipt' },
  { key: 'commitments', href: '/finance/commitments', label: 'Commitments', icon: 'bi-journal-check' },
  { key: 'reallocations', href: '/finance/reallocations', label: 'Budget Reallocations', icon: 'bi-arrow-left-right' },
  { key: 'review', href: '/finance/review-queue', label: 'Review Queue', icon: 'bi-check2-square', reviewerOnly: true },
  { key: 'approvals', href: '/finance/approvals', label: 'Budget Approvals', icon: 'bi-patch-check', approverOnly: true },
  { key: 'attention', href: '/finance/needs-attention', label: 'Needs Attention', icon: 'bi-exclamation-triangle' },
  { key: 'quarterly', href: '/finance/quarterly', label: 'Quarterly Reports', icon: 'bi-calendar3' },
];

export default function FinanceWorkspace({ user, finance, active, title, description, actions, children }) {
  const role = finance?.actor?.financeRole
    ? `Finance ${titleCase(finance.actor.financeRole)}`
    : finance?.actor?.isManager
      ? 'Management · read only'
      : 'Project finance · read only';

  return (
    <AppLayout user={user}>
      <div className={styles.workspace}>
        <PageHeader
          eyebrow="Financial control"
          title={title}
          description={description}
          actions={(
            <>
              <span className={styles.rolePill}><i className="bi bi-shield-check" />{role}</span>
              {actions}
            </>
          )}
        />
        <nav className={`${styles.navBar} ${styles.noPrint}`} aria-label="Finance sections">
          {NAV_ITEMS.filter((item) => (
            (!item.reviewerOnly || finance?.actor?.canReview) &&
            (!item.approverOnly || finance?.actor?.canApproveBudgets) &&
            (!item.administratorOnly || finance?.actor?.canAdministerFinance)
          )).map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={`${styles.navLink} ${active === item.key ? styles.navLinkActive : ''}`}
            >
              <i className={`bi ${item.icon}`} />{item.label}
            </Link>
          ))}
        </nav>
        {children}
      </div>
    </AppLayout>
  );
}
