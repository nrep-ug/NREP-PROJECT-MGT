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

/**
 * project: optional { $id, name, code } the page is scoped to. Adds a
 *   "Finance › CODE" breadcrumb and, unless `back` is given, a back link to
 *   that project's Finance page.
 * back: optional { href, label } shown top-left; pass null to hide.
 */
export default function FinanceWorkspace({ user, finance, active, title, description, actions, back, project, children }) {
  const backLink = back !== undefined
    ? back
    : project ? { href: `/finance/${project.$id}`, label: `Back to ${project.code || project.name} Finance` } : null;
  const eyebrow = project ? (
    <>
      <Link href="/finance" className={styles.crumb}>Finance</Link>
      <i className="bi bi-chevron-right mx-1" aria-hidden="true" />
      <Link href={`/finance/${project.$id}`} className={styles.crumb}>{project.code || project.name}</Link>
    </>
  ) : 'Financial control';
  const role = finance?.actor?.financeRole
    ? `Finance ${titleCase(finance.actor.financeRole)}`
    : finance?.actor?.isManager
      ? 'Management · read only'
      : 'Project finance · read only';

  return (
    <AppLayout user={user}>
      <div className={styles.workspace}>
        {backLink && (
          <div className={`mb-3 ${styles.noPrint}`}>
            <Link href={backLink.href} className="btn btn-secondary btn-sm">
              <i className="bi bi-arrow-left me-2" />{backLink.label}
            </Link>
          </div>
        )}
        <PageHeader
          eyebrow={eyebrow}
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
