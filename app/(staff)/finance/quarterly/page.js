'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Form, Spinner, Table } from 'react-bootstrap';
import AppLayout from '@/components/AppLayout';
import FinanceWorkspace from '@/components/finance/FinanceWorkspace';
import financeStyles from '@/components/finance/FinanceWorkspace.module.css';
import EmptyState from '@/components/ui/EmptyState';
import MetricCard from '@/components/ui/MetricCard';
import SectionCard from '@/components/ui/SectionCard';
import { useFinanceContext } from '@/hooks/useFinanceContext';
import { authenticatedFetch } from '@/lib/apiClient';
import { formatCurrency, formatPercent } from '@/lib/financeFormat';

export default function QuarterlyFinancePage() {
  const { user, finance, loading: contextLoading, error: contextError } = useFinanceContext();
  const [projectId, setProjectId] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [quarter, setQuarter] = useState(Math.floor(new Date().getMonth() / 3) + 1);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!projectId && finance?.projects?.length) setProjectId(finance.projects[0].$id);
  }, [finance, projectId]);

  const query = useCallback(() => new URLSearchParams({ projectId, year: String(year), quarter: String(quarter) }), [projectId, year, quarter]);
  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError('');
    try {
      const response = await authenticatedFetch(`/api/finance/quarterly?${query()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Quarterly report could not be generated.');
      setReport(data);
    } catch (requestError) {
      setReport(null);
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [projectId, query]);

  useEffect(() => { load(); }, [load]);

  const exportCsv = async () => {
    try {
      const response = await authenticatedFetch(`/api/finance/quarterly/export?${query()}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'CSV export failed.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = response.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] || `finance-${year}-Q${quarter}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  if (contextLoading) return <AppLayout user={user}><div className="text-center py-5"><Spinner animation="border" /></div></AppLayout>;
  if (contextError || !finance) return <AppLayout user={user}><Alert variant="danger" className="mt-4">{contextError}</Alert></AppLayout>;

  const currency = report?.project?.currency || finance.projects.find((project) => project.$id === projectId)?.budgetCurrency;
  return (
    <FinanceWorkspace
      user={user}
      finance={finance}
      active="quarterly"
      title="Quarterly Finance"
      description="Source-transaction reporting by activity, category, responsible staff, and approved reallocation."
      actions={<><Button className={financeStyles.noPrint} variant="secondary" onClick={() => window.print()} disabled={!report}><i className="bi bi-printer me-1" />Print</Button><Button className={financeStyles.noPrint} variant="secondary" onClick={exportCsv} disabled={!report}><i className="bi bi-download me-1" />CSV</Button></>}
    >
      <div className={financeStyles.filterBar}>
        <div className={financeStyles.filterWide}><Form.Label className="small fw-semibold">Project</Form.Label><Form.Select value={projectId} onChange={(event) => setProjectId(event.target.value)}>{finance.projects.map((project) => <option key={project.$id} value={project.$id}>{project.code} · {project.name}</option>)}</Form.Select></div>
        <div><Form.Label className="small fw-semibold">Year</Form.Label><Form.Control type="number" min="2000" max="2100" value={year} onChange={(event) => setYear(Number(event.target.value))} /></div>
        <div><Form.Label className="small fw-semibold">Quarter</Form.Label><Form.Select value={quarter} onChange={(event) => setQuarter(Number(event.target.value))}>{[1,2,3,4].map((value) => <option key={value} value={value}>Q{value}</option>)}</Form.Select></div>
        <div className="d-flex align-items-end"><Button variant="secondary" onClick={load} disabled={loading}>Generate</Button></div>
      </div>
      <div className={financeStyles.printOnly}><h1>{report?.project?.name} · {year} Q{quarter} Finance Report</h1></div>
      {error && <Alert variant="danger">{error}</Alert>}
      {loading ? <div className="text-center py-5"><Spinner animation="border" /></div> : report ? (
        <>
          <div className="row g-3 mb-4">
            <div className="col-sm-6 col-xl"><MetricCard label="Original budget" value={formatCurrency(report.totals.originalBudget, currency)} icon="bi-bank" /></div>
            <div className="col-sm-6 col-xl"><MetricCard label="Revised budget" value={formatCurrency(report.totals.revisedBudget, currency)} icon="bi-arrow-left-right" /></div>
            <div className="col-sm-6 col-xl"><MetricCard label="Quarter spend" value={formatCurrency(report.totals.quarterSpend, currency)} icon="bi-calendar3" /></div>
            <div className="col-sm-6 col-xl"><MetricCard label="Cumulative spend" value={formatCurrency(report.totals.cumulativeSpend, currency)} icon="bi-graph-up" /></div>
            <div className="col-sm-6 col-xl"><MetricCard label="Remaining" value={formatCurrency(report.totals.remaining, currency)} hint={`${formatPercent(report.totals.utilisation)} utilised`} icon="bi-pie-chart" /></div>
          </div>
          <SectionCard title="Activity performance" description={`${report.project.code} · ${report.project.name} · ${report.year} Q${report.quarter}`} flush>
            {report.activities.length === 0 ? <EmptyState title="No approved activity budgets" /> : <div className={financeStyles.tableWrap}><Table className={financeStyles.dataTable}><thead><tr><th>Activity</th><th className="text-end">Original</th><th className="text-end">Revised</th><th className="text-end">Quarter spend</th><th className="text-end">Cumulative</th><th className="text-end">Remaining</th><th>Utilisation</th></tr></thead><tbody>{report.activities.map((activity) => <tr key={activity.budgetLineId}><td><strong>{activity.activityCode || '—'}</strong><div className="small text-muted">{activity.activityName}</div></td><td className="text-end">{formatCurrency(activity.originalBudget, activity.currency)}</td><td className="text-end">{formatCurrency(activity.revisedBudget, activity.currency)}</td><td className="text-end">{formatCurrency(activity.quarterSpend, activity.currency)}</td><td className="text-end">{formatCurrency(activity.cumulativeSpend, activity.currency)}</td><td className="text-end">{formatCurrency(activity.remaining, activity.currency)}</td><td>{formatPercent(activity.utilisation)}</td></tr>)}</tbody></Table></div>}
          </SectionCard>
          <div className="row g-4 mt-1">
            <div className="col-lg-6"><SectionCard title="Spend by category">{report.byCategory.length ? report.byCategory.sort((a,b) => b.amount-a.amount).map((item) => <div key={item.name} className="d-flex justify-content-between py-2 border-bottom"><span className="text-capitalize">{item.name.replaceAll('_',' ')}</span><strong>{formatCurrency(item.amount, currency)}</strong></div>) : <EmptyState title="No spend this quarter" />}</SectionCard></div>
            <div className="col-lg-6"><SectionCard title="Spend by responsible staff">{report.byResponsible.length ? report.byResponsible.sort((a,b) => b.amount-a.amount).map((item) => <div key={item.name} className="d-flex justify-content-between py-2 border-bottom"><span>{item.name}</span><strong>{formatCurrency(item.amount, currency)}</strong></div>) : <EmptyState title="No responsible-staff spend" />}</SectionCard></div>
          </div>
          <div className="mt-4"><SectionCard title="Approved reallocations in quarter">{report.reallocations.length ? report.reallocations.map((item) => <div key={item.$id} className="d-flex justify-content-between gap-3 py-2 border-bottom"><span><strong>{item.fromActivityCode || item.fromActivityName}</strong> → <strong>{item.toActivityCode || item.toActivityName}</strong><small className="text-muted d-block">{item.reason}</small></span><strong>{formatCurrency(item.amount, item.currency)}</strong></div>) : <EmptyState title="No approved reallocations" />}</SectionCard></div>
        </>
      ) : <EmptyState title="Choose a project and generate a report" />}
    </FinanceWorkspace>
  );
}

