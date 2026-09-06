'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Table, Badge, Button, Form, InputGroup } from 'react-bootstrap';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useProjects } from '@/hooks/useProjects';
import { useClients } from '@/hooks/useClients';
import { formatDate } from '@/lib/date';
import AppLayout from '@/components/AppLayout';
import LoadingSpinner from '@/components/LoadingSpinner';
import Toast, { useToast } from '@/components/Toast';
import StatusBadge from '@/components/ui/StatusBadge';
import styles from '@/components/project/ProjectViews.module.css';

const STATUS_FILTERS = ['all', 'active', 'planned', 'on_hold', 'completed'];

function getCurrencySymbol(currency) {
  switch (currency) {
    case 'USD': return '$';
    case 'GBP': return '£';
    case 'EUR': return '€';
    case 'UGX': return 'Sh';
    default: return '$';
  }
}

export default function ProjectsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { data: projects = [], isLoading: projectsLoading, error: projectsError } = useProjects(user?.organizationId);
  const { data: clients = [] } = useClients(user?.organizationId, user?.authUser?.$id);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  const { toast, showToast, hideToast } = useToast();

  const filteredProjects = projects.filter((project) => {
    const matchesSearch = project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: projects.length,
    active: projects.filter((p) => p.status === 'active').length,
    planned: projects.filter((p) => p.status === 'planned').length,
    completed: projects.filter((p) => p.status === 'completed').length,
  };

  if (authLoading || projectsLoading) {
    return <AppLayout user={user}><LoadingSpinner message="Loading projects..." /></AppLayout>;
  }

  if (projectsError) {
    return <AppLayout user={user}><div className="alert alert-danger">Failed to load projects: {projectsError.message}</div></AppLayout>;
  }

  return (
    <AppLayout user={user}>
      <Toast toast={toast} onClose={hideToast} />

      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Projects</h1>
          <p className={styles.pageSubtitle}>Manage and track your organization&apos;s projects.</p>
        </div>
        {user?.isAdmin && (
          <Button onClick={() => router.push('/projects/new')}>
            <i className="bi bi-plus-circle me-2" />New Project
          </Button>
        )}
      </div>

      <div className={styles.statGrid}>
        <div className={styles.statCard}>
          <span className={`${styles.statIcon} blue`}><i className="bi bi-folder-fill" /></span>
          <div><div className={styles.statValue}>{stats.total}</div><div className={styles.statLabel}>Total Projects</div></div>
        </div>
        <div className={styles.statCard}>
          <span className={`${styles.statIcon} green`}><i className="bi bi-play-circle-fill" /></span>
          <div><div className={styles.statValue}>{stats.active}</div><div className={styles.statLabel}>Active</div></div>
        </div>
        <div className={styles.statCard}>
          <span className={`${styles.statIcon} neutral`}><i className="bi bi-hourglass-split" /></span>
          <div><div className={styles.statValue}>{stats.planned}</div><div className={styles.statLabel}>Planned</div></div>
        </div>
        <div className={styles.statCard}>
          <span className={`${styles.statIcon} orange`}><i className="bi bi-check-circle-fill" /></span>
          <div><div className={styles.statValue}>{stats.completed}</div><div className={styles.statLabel}>Completed</div></div>
        </div>
      </div>

      <div className={styles.toolbar}>
        <InputGroup className={styles.toolbarSearch}>
          <InputGroup.Text className="bg-white"><i className="bi bi-search" /></InputGroup.Text>
          <Form.Control
            placeholder="Search projects by name or code…"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </InputGroup>
        <div className={styles.toolbarGroup}>
          {STATUS_FILTERS.map((status) => (
            <button
              key={status}
              type="button"
              className={`${styles.chip} ${statusFilter === status ? styles.chipActive : ''}`}
              onClick={() => setStatusFilter(status)}
            >
              {status === 'all' ? 'All' : status === 'on_hold' ? 'On Hold' : status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
        <div className={styles.viewToggle}>
          <button type="button" aria-label="Grid view" aria-pressed={viewMode === 'grid'} className={viewMode === 'grid' ? styles.viewToggleActive : ''} onClick={() => setViewMode('grid')}><i className="bi bi-grid-3x3-gap" /></button>
          <button type="button" aria-label="Table view" aria-pressed={viewMode === 'table'} className={viewMode === 'table' ? styles.viewToggleActive : ''} onClick={() => setViewMode('table')}><i className="bi bi-table" /></button>
        </div>
      </div>

      {filteredProjects.length === 0 ? (
        <div className="text-center py-5">
          <i className="bi bi-folder-x" style={{ fontSize: '2.5rem', color: 'var(--nrep-border)' }} />
          <h5 className="fw-bold mt-3 mb-2">{projects.length === 0 ? 'No projects yet' : 'No projects found'}</h5>
          <p className="text-muted mb-3">
            {projects.length === 0
              ? (user?.isAdmin ? 'Get started by creating your first project.' : 'No projects have been created yet.')
              : 'Try adjusting your search or filter criteria.'}
          </p>
          {projects.length === 0 && user?.isAdmin && (
            <Button onClick={() => router.push('/projects/new')}><i className="bi bi-plus-circle me-2" />Create Your First Project</Button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className={styles.cardGrid}>
          {filteredProjects.map((project) => {
            const client = clients.find((c) => c.$id === project.clientId);
            const isDemo = Boolean(project.demoSeedId);
            return (
              <Link key={project.$id} href={`/projects/${project.$id}`} className={styles.projectCard}>
                <div className={styles.cardTopRow}>
                  <span className={styles.codeChip}>{project.code}</span>
                  <div className="d-flex align-items-center gap-2">
                    {isDemo && <span className={styles.demoChip}><i className="bi bi-stars" />Demo</span>}
                    <StatusBadge status={project.status} />
                  </div>
                </div>
                <h3 className={styles.cardTitle}>{project.name}</h3>
                {isDemo && <p className={styles.cardDescription} style={{ fontStyle: 'italic' }}>Test financial workflow data — safe to use for training and demos.</p>}
                {!isDemo && project.description && <p className={styles.cardDescription}>{project.description}</p>}
                {client && <div className={styles.cardMetaRow}><i className="bi bi-building" />{client.name}</div>}
                {(project.startDate || project.endDate) && (
                  <div className={styles.cardMetaRow}>
                    <i className="bi bi-calendar-event" />
                    {project.startDate && formatDate(project.startDate)}{project.startDate && project.endDate && ' – '}{project.endDate && formatDate(project.endDate)}
                  </div>
                )}
                <div className={styles.cardFooter}>
                  <span className={styles.cardFooterLabel}>Budget</span>
                  <span className={styles.cardFooterValue}>{getCurrencySymbol(project.budgetCurrency || 'USD')}{project.budgetAmount?.toLocaleString() || '0'}</span>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="table-responsive" style={{ background: 'var(--nrep-card-bg)', border: '1px solid var(--nrep-border)', borderRadius: 'var(--radius-lg)' }}>
          <Table hover className="mb-0 align-middle">
            <thead>
              <tr>
                <th className="border-0 py-3 px-4 text-muted small fw-semibold text-uppercase">Code</th>
                <th className="border-0 py-3 text-muted small fw-semibold text-uppercase">Project</th>
                <th className="border-0 py-3 text-muted small fw-semibold text-uppercase">Client</th>
                <th className="border-0 py-3 text-muted small fw-semibold text-uppercase">Status</th>
                <th className="border-0 py-3 text-muted small fw-semibold text-uppercase">Timeline</th>
                <th className="border-0 py-3 text-muted small fw-semibold text-uppercase text-end px-4">Budget</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map((project) => {
                const client = clients.find((c) => c.$id === project.clientId);
                return (
                  <tr key={project.$id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/projects/${project.$id}`)}>
                    <td className="py-3 px-4"><span className={styles.codeChip}>{project.code}</span></td>
                    <td className="py-3">
                      <div className="fw-semibold d-flex align-items-center gap-2">
                        {project.name}
                        {project.demoSeedId && <span className={styles.demoChip}>Demo</span>}
                      </div>
                    </td>
                    <td className="py-3">{client ? <span className="small">{client.name}</span> : <span className="text-muted small">—</span>}</td>
                    <td className="py-3"><StatusBadge status={project.status} /></td>
                    <td className="py-3">
                      {project.startDate ? (
                        <span className="text-muted small">{formatDate(project.startDate)}{project.endDate ? ` – ${formatDate(project.endDate)}` : ''}</span>
                      ) : <span className="text-muted small">Not set</span>}
                    </td>
                    <td className="py-3 text-end px-4"><span className="fw-bold" style={{ color: 'var(--nrep-deep-blue)' }}>{getCurrencySymbol(project.budgetCurrency || 'USD')}{project.budgetAmount?.toLocaleString() || '0'}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      )}
    </AppLayout>
  );
}
