'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Alert, Badge, Button, Form, Spinner } from 'react-bootstrap';
import AppLayout from '@/components/AppLayout';
import FinanceWorkspace from '@/components/finance/FinanceWorkspace';
import financeStyles from '@/components/finance/FinanceWorkspace.module.css';
import EmptyState from '@/components/ui/EmptyState';
import SectionCard from '@/components/ui/SectionCard';
import { useFinanceContext } from '@/hooks/useFinanceContext';
import { authenticatedFetch } from '@/lib/apiClient';
import { formatCurrency, formatFinanceDate, titleCase } from '@/lib/financeFormat';

const EXCEPTION_TYPES = [
  ['near_limit', 'Near budget limit'],
  ['over_budget', 'Over budget'],
  ['aged_review', 'Review overdue'],
  ['pending_reallocation', 'Pending reallocation'],
  ['missing_evidence', 'Missing evidence'],
  ['variance_explanation_required', 'Variance explanation required'],
  ['no_spend', 'Material budget with no spend'],
];

const SEVERITY = Object.freeze({
  critical: { variant: 'danger', icon: 'bi-exclamation-octagon-fill', label: 'Critical severity' },
  high: { variant: 'danger', icon: 'bi-exclamation-triangle-fill', label: 'High severity' },
  warning: { variant: 'warning', icon: 'bi-exclamation-triangle', label: 'Warning severity' },
  medium: { variant: 'warning', icon: 'bi-exclamation-circle', label: 'Medium severity' },
  info: { variant: 'info', icon: 'bi-info-circle', label: 'Information' },
  low: { variant: 'secondary', icon: 'bi-info-circle', label: 'Low severity' },
});

function severityDetails(value) {
  const normalized = String(value || 'warning').toLowerCase();
  return SEVERITY[normalized] || {
    variant: 'secondary',
    icon: 'bi-exclamation-circle',
    label: `${titleCase(normalized)} severity`,
  };
}

function FinanceNeedsAttentionContent() {
  const searchParams = useSearchParams();
  const { user, finance, loading: contextLoading, error: contextError } = useFinanceContext();
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState({ projectId: searchParams.get('projectId') || '', type: '', severity: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!finance) return;
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams();
      if (filters.projectId) query.set('projectId', filters.projectId);
      if (filters.type) query.set('type', filters.type);
      if (filters.severity) query.set('severity', filters.severity);
      const response = await authenticatedFetch(`/api/finance/exceptions${query.size ? `?${query}` : ''}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Finance exceptions could not be loaded.');
      setItems(data.items || []);
    } catch (requestError) {
      setItems([]);
      setError(requestError.message || 'Finance exceptions could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [finance, filters]);

  useEffect(() => { load(); }, [load]);

  if (contextLoading) {
    return <AppLayout user={user}><div className="text-center py-5"><Spinner animation="border" /></div></AppLayout>;
  }
  if (contextError || !finance) {
    return <AppLayout user={user}><Alert variant="danger" className="mt-4">{contextError}</Alert></AppLayout>;
  }

  return (
    <FinanceWorkspace
      user={user}
      finance={finance}
      active="attention"
      title="Needs Attention"
      description="Review genuine financial exceptions and follow each item to its underlying project, activity, transaction, or evidence."
      actions={<Button variant="secondary" onClick={load} disabled={loading}><i className="bi bi-arrow-clockwise me-1" />Refresh</Button>}
    >
      <div className={financeStyles.filterBar}>
        <div className={financeStyles.filterWide}>
          <Form.Label className="small fw-semibold">Project</Form.Label>
          <Form.Select value={filters.projectId} onChange={(event) => setFilters((current) => ({ ...current, projectId: event.target.value }))}>
            <option value="">All accessible projects</option>
            {finance.projects.map((project) => <option key={project.$id} value={project.$id}>{project.code} - {project.name}</option>)}
          </Form.Select>
        </div>
        <div>
          <Form.Label className="small fw-semibold">Exception type</Form.Label>
          <Form.Select value={filters.type} onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))}>
            <option value="">All types</option>
            {EXCEPTION_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Form.Select>
        </div>
        <div>
          <Form.Label className="small fw-semibold">Severity</Form.Label>
          <Form.Select value={filters.severity} onChange={(event) => setFilters((current) => ({ ...current, severity: event.target.value }))}>
            <option value="">All severities</option>
            {['critical', 'high', 'warning', 'medium', 'info', 'low'].map((value) => <option key={value} value={value}>{severityDetails(value).label}</option>)}
          </Form.Select>
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}
      <SectionCard title="Finance exceptions" description={`${items.length} item${items.length === 1 ? '' : 's'} require review`}>
        {loading ? (
          <div className="text-center py-5"><Spinner animation="border" /></div>
        ) : items.length === 0 ? (
          <EmptyState icon="bi-check2-circle" title="No Finance exceptions" text="No records currently match the selected exception filters." />
        ) : (
          <div className="d-flex flex-column gap-3">
            {items.map((item) => {
              const severity = severityDetails(item.severity);
              return (
                <Link
                  key={item.$id || item.id || `${item.type}-${item.recordId}`}
                  href={item.href}
                  className={`${financeStyles.reviewCard} d-block text-reset text-decoration-none`}
                  aria-label={`Open ${item.title || titleCase(item.type)} details`}
                >
                  <div className="d-flex flex-column flex-md-row justify-content-between gap-3">
                    <div className="min-w-0">
                      <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                        <Badge bg={severity.variant} text={severity.variant === 'warning' || severity.variant === 'info' ? 'dark' : undefined}>
                          <i className={`bi ${severity.icon} me-1`} aria-hidden="true" />{severity.label}
                        </Badge>
                        <span className="small fw-semibold text-primary">{item.typeLabel || titleCase(item.type)}</span>
                        {item.detectedAt && <span className="small text-muted">Detected {formatFinanceDate(item.detectedAt)}</span>}
                      </div>
                      <h3 className="h6 mb-1">{item.title || item.activityName || 'Finance exception'}</h3>
                      <p className="small text-muted mb-2">{item.description || item.message}</p>
                      <div className="d-flex flex-wrap gap-3 small">
                        {(item.projectCode || item.projectName) && <span><strong>Project:</strong> {item.projectCode ? `${item.projectCode} - ` : ''}{item.projectName}</span>}
                        {item.activityName && <span><strong>Activity:</strong> {item.activityCode ? `${item.activityCode} - ` : ''}{item.activityName}</span>}
                        {item.amount !== undefined && item.currency && <span><strong>Amount:</strong> {formatCurrency(item.amount, item.currency)}</span>}
                        {item.ageDays !== undefined && <span><strong>Waiting:</strong> {item.ageDays} day{item.ageDays === 1 ? '' : 's'}</span>}
                      </div>
                    </div>
                    <div className="align-self-md-center text-primary fw-semibold text-nowrap">
                      Open record <i className="bi bi-arrow-right ms-1" aria-hidden="true" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </SectionCard>
    </FinanceWorkspace>
  );
}

export default function FinanceNeedsAttentionPage() {
  return (
    <Suspense fallback={<AppLayout><div className="text-center py-5"><Spinner animation="border" /></div></AppLayout>}>
      <FinanceNeedsAttentionContent />
    </Suspense>
  );
}
