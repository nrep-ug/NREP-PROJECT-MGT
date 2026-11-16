'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, Form, Spinner, Table } from 'react-bootstrap';
import AppLayout from '@/components/AppLayout';
import FinanceWorkspace from '@/components/finance/FinanceWorkspace';
import financeStyles from '@/components/finance/FinanceWorkspace.module.css';
import EmptyState from '@/components/ui/EmptyState';
import MetricCard from '@/components/ui/MetricCard';
import SectionCard from '@/components/ui/SectionCard';
import { useFinanceContext } from '@/hooks/useFinanceContext';
import { authenticatedFetch } from '@/lib/apiClient';
import { formatCurrency, formatPercent } from '@/lib/financeFormat';

/**
 * The global Finance workspace — the entry point for Finance users who work
 * across projects. Picking a project here jumps straight to that project's
 * own Finance view (/finance/[projectId]) — the same page Projects →
 * [project] → Finance links to — so there is exactly one place a single
 * project's numbers are ever rendered, not two slightly different copies.
 */
export default function FinanceOverviewPage() {
  const router = useRouter();
  const { user, finance, loading: contextLoading, error: contextError } = useFinanceContext();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadSummary = useCallback(async () => {
    if (!finance) return;
    setLoading(true);
    setError('');
    try {
      const response = await authenticatedFetch('/api/finance/summary');
      const data = await response.json();
      if (!response.ok) {
        // A Project Head with no organization-wide Finance role legitimately
        // gets FINANCE_READ_REQUIRED here — they still see their own led
        // project(s) via finance.projects, so fall back to that list instead
        // of a dead-end error (organization-wide visibility stays denied).
        if (data.code === 'FINANCE_READ_REQUIRED' && finance.projects.length > 0) {
          setSummary(null);
        } else {
          throw new Error(data.error || 'Finance summary could not be loaded.');
        }
      } else {
        setSummary(data);
      }
    } catch (requestError) {
      setError(requestError.message);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [finance]);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  if (contextLoading) {
    return <AppLayout user={user}><div className="d-flex justify-content-center py-5"><Spinner animation="border" /></div></AppLayout>;
  }
  if (contextError || !finance) {
    return <AppLayout user={user}><Alert variant="danger" className="mt-4">{contextError || 'Finance access is unavailable.'}</Alert></AppLayout>;
  }

  return (
    <FinanceWorkspace
      user={user}
      finance={finance}
      active="overview"
      title="Finance"
      description="How much is budgeted, spent, committed, and available — across every project you can see."
      actions={finance.projects.length > 0 && (
        <Form.Select
          style={{ maxWidth: 260 }}
          defaultValue=""
          onChange={(event) => { if (event.target.value) router.push(`/finance/${event.target.value}`); }}
        >
          <option value="">Jump to a project…</option>
          {finance.projects.map((project) => <option key={project.$id} value={project.$id}>{project.code} · {project.name}</option>)}
        </Form.Select>
      )}
    >
      {error && <Alert variant="danger">{error}</Alert>}
      {loading ? <div className="text-center py-5"><Spinner animation="border" /></div> : !summary ? (
        <SectionCard title="Your projects" description="Organization-wide Finance visibility isn't part of your role — open a project below to see its budget, spend, and activity.">
          {finance.projects.length === 0 ? <EmptyState icon="bi-wallet2" title="No Finance-visible projects" text="You don't lead or have Finance access to any project yet." /> : (
            <div className="d-flex flex-column gap-2">
              {finance.projects.map((project) => (
                <Link key={project.$id} href={`/finance/${project.$id}`} className="text-reset text-decoration-none d-flex justify-content-between align-items-center py-2 border-bottom">
                  <span><strong>{project.code}</strong> · {project.name}</span>
                  <i className="bi bi-arrow-right" />
                </Link>
              ))}
            </div>
          )}
        </SectionCard>
      ) : (
        <>
          {summary.currencyGroups.length === 0 ? (
            <SectionCard title="Financial position">
              <EmptyState icon="bi-wallet2" title="No approved budgets yet" text="Finance Officers can create the first activity budget from Activity Budgets." />
            </SectionCard>
          ) : summary.currencyGroups.map((group) => (
            <section key={group.currency} className="mb-4" aria-label={`Financial position in ${group.currency}`}>
              <div className="d-flex flex-wrap justify-content-between align-items-baseline gap-2 mb-3">
                <h2 className="h5 fw-bold mb-0">Financial position — {group.currency}</h2>
                <span className="small text-muted">This quarter&apos;s spend so far: <strong className="text-body">{formatCurrency(group.quarterSpend || 0, group.currency)}</strong></span>
              </div>
              <div className="row g-3">
                <div className="col-sm-6 col-xl-3"><MetricCard label="Total budget" value={formatCurrency(group.revisedBudget, group.currency)} icon="bi-bank" /></div>
                <div className="col-sm-6 col-xl-3"><MetricCard label="Actual spend" value={formatCurrency(group.actualSpend ?? group.approvedSpend, group.currency)} icon="bi-receipt" /></div>
                <div className="col-sm-6 col-xl-3"><MetricCard label="Committed" value={formatCurrency(group.committedAmount || 0, group.currency)} icon="bi-journal-check" /></div>
                <div className="col-sm-6 col-xl-3"><MetricCard label="Available" value={formatCurrency(group.availableBalance, group.currency)} hint={`${formatPercent(group.utilisation)} utilised`} icon="bi-pie-chart" /></div>
              </div>
            </section>
          ))}

          <div className="row g-3 mb-4">
            <div className="col-md-6">
              <Link href="/finance/review-queue" className="text-reset text-decoration-none d-block h-100">
                <MetricCard layout="row" tone="blue" label="Pending review" hint="Records waiting for approval" value={String(summary.pendingReview)} icon="bi-hourglass-split" />
              </Link>
            </div>
            <div className="col-md-6">
              <Link href="/finance/needs-attention" className="text-reset text-decoration-none d-block h-100">
                <MetricCard layout="row" tone="amber" label="Needs attention" hint="Activities near or over budget" value={String(summary.exceptions)} icon="bi-exclamation-triangle" />
              </Link>
            </div>
          </div>

          <SectionCard title="Project financial performance" description="Each project is shown in its own configured currency — click a project to open it, or a figure to see what makes it up." flush>
            {summary.projects.length === 0 ? <EmptyState title="No project finance data" text="Approved project activity budgets will appear here." /> : (
              <div className={financeStyles.tableWrap}>
                <Table hover className={financeStyles.dataTable}>
                  <thead><tr><th>Project</th><th className="text-end">Budget</th><th className="text-end">Actual</th><th className="text-end">Committed</th><th className="text-end">Available</th><th>Utilisation</th><th>Attention</th><th /></tr></thead>
                  <tbody>{summary.projects.map((project) => (
                    <tr key={project.$id}>
                      <td><Link href={`/finance/${project.$id}`} className="text-reset text-decoration-none"><div className="fw-semibold">{project.name}</div><small className="text-muted">{project.code}</small></Link></td>
                      <td className="text-end"><Link href={`/finance/budgets?projectId=${project.$id}`} className="text-reset">{formatCurrency(project.revisedBudget, project.budgetCurrency)}</Link></td>
                      <td className="text-end"><Link href={`/finance/expenses?projectId=${project.$id}&status=approved`} className="text-reset">{formatCurrency(project.actualSpend ?? project.approvedSpend, project.budgetCurrency)}</Link></td>
                      <td className="text-end"><Link href={`/finance/commitments?projectId=${project.$id}`} className="text-reset">{formatCurrency(project.committedAmount || 0, project.budgetCurrency)}</Link></td>
                      <td className="text-end">{formatCurrency(project.availableBalance, project.budgetCurrency)}</td>
                      <td>{formatPercent(project.utilisation)}</td>
                      <td>{project.exceptions > 0 ? <Link href={`/finance/needs-attention?projectId=${project.$id}`}>{project.exceptions}</Link> : '—'}</td>
                      <td className="text-end"><Link className="btn btn-sm btn-secondary" href={`/finance/${project.$id}`}>View</Link></td>
                    </tr>
                  ))}</tbody>
                </Table>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Recent significant reallocations" className="mt-4">
            {summary.recentReallocations?.length ? summary.recentReallocations.map((item) => (
              <div className="d-flex justify-content-between align-items-center gap-3 py-2 border-bottom" key={item.$id}>
                <div>
                  <strong>{item.fromActivityCode || item.fromActivityName} → {item.toActivityCode || item.toActivityName}</strong>
                  <div className="small text-muted">{item.projectName} · {item.reason}</div>
                </div>
                <span className="fw-semibold text-nowrap">{formatCurrency(item.amount, item.currency)}</span>
              </div>
            )) : <EmptyState icon="bi-arrow-left-right" title="No recent reallocations" text="Approved transfers between activities will appear here." />}
          </SectionCard>
        </>
      )}
    </FinanceWorkspace>
  );
}
