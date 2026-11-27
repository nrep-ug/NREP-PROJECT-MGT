'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Form, InputGroup, ProgressBar } from 'react-bootstrap';
import { useProjectMilestones, useProjectTasks } from '@/hooks/useProjects';
import { formatDate } from '@/lib/date';
import StatusBadge from '@/components/ui/StatusBadge';
import styles from './ProjectViews.module.css';

const STATUS_ICON = { open: 'bi-flag', reached: 'bi-flag-fill', closed: 'bi-archive' };

export default function ProjectMilestones({ project, user, showToast, canModify }) {
  const router = useRouter();
  const { data: milestones = [], isLoading: milestonesLoading } = useProjectMilestones(project?.$id);
  const { data: tasks = [] } = useProjectTasks(project?.$id);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const taskCountFor = (milestoneId) => tasks.filter((t) => t.milestoneId === milestoneId).length;
  const progressFor = (milestoneId) => {
    const list = tasks.filter((t) => t.milestoneId === milestoneId);
    if (list.length === 0) return 0;
    return Math.round((list.filter((t) => t.status === 'done').length / list.length) * 100);
  };

  const filtered = useMemo(() => milestones.filter((m) => {
    const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.description && m.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
    return matchesSearch && matchesStatus;
  }), [milestones, searchTerm, statusFilter]);

  const stats = {
    total: milestones.length,
    open: milestones.filter((m) => m.status === 'open').length,
    reached: milestones.filter((m) => m.status === 'reached').length,
    closed: milestones.filter((m) => m.status === 'closed').length,
  };

  // Build a lightweight two-level hierarchy from parentActivityId — items with
  // no parent (or whose parent isn't in the filtered set) render as their own
  // group; items with a visible parent nest under it. Falls back gracefully
  // for schedules that never used activity codes/parents at all.
  const groups = useMemo(() => {
    const byId = new Map(filtered.map((m) => [m.$id, m]));
    const sortKey = (m) => (Number.isFinite(m.sortOrder) ? m.sortOrder : Number.MAX_SAFE_INTEGER);
    const roots = filtered.filter((m) => !m.parentActivityId || !byId.has(m.parentActivityId));
    return roots
      .sort((a, b) => sortKey(a) - sortKey(b) || String(a.activityCode || '').localeCompare(String(b.activityCode || '')))
      .map((root) => ({
        root,
        children: filtered
          .filter((m) => m.parentActivityId === root.$id)
          .sort((a, b) => sortKey(a) - sortKey(b) || String(a.activityCode || '').localeCompare(String(b.activityCode || ''))),
      }));
  }, [filtered]);

  const ActivityCard = ({ milestone }) => {
    const progress = progressFor(milestone.$id);
    const count = taskCountFor(milestone.$id);
    const isOverdue = milestone.dueDate && new Date(milestone.dueDate) < new Date() && !['reached', 'closed'].includes(milestone.status);
    return (
      <div
        className={styles.activityCard}
        role="button"
        tabIndex={0}
        onClick={() => router.push(`/projects/${project.$id}/milestones/${milestone.$id}`)}
        onKeyDown={(event) => { if (event.key === 'Enter') router.push(`/projects/${project.$id}/milestones/${milestone.$id}`); }}
      >
        <div className={styles.activityTopRow}>
          <div className="d-flex align-items-center gap-2 min-w-0">
            {milestone.activityCode && <span className={styles.activityCode}>{milestone.activityCode}</span>}
            <i className={`bi ${STATUS_ICON[milestone.status] || 'bi-flag'} text-muted`} />
          </div>
          <StatusBadge status={milestone.status} />
        </div>
        <h4 className={styles.activityName}>{milestone.name}</h4>
        {milestone.description && <p className="text-muted small mb-0 mt-1" style={{ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{milestone.description}</p>}
        <div className={styles.activityMetaRow}>
          <span className={styles.activityMetaItem}><i className="bi bi-calendar-event" />{milestone.startDate ? formatDate(milestone.startDate) : 'No start date'}</span>
          <span className={styles.activityMetaItem} style={isOverdue ? { color: 'var(--nrep-danger)', fontWeight: 600 } : undefined}>
            <i className="bi bi-calendar-check" />{milestone.dueDate ? formatDate(milestone.dueDate) : 'No due date'}{isOverdue ? ' · Overdue' : ''}
          </span>
          {count > 0 && <span className={styles.activityMetaItem}><i className="bi bi-list-task" />{count} task{count === 1 ? '' : 's'}</span>}
        </div>
        {count > 0 && (
          <div className="mt-2">
            <ProgressBar now={progress} variant={progress === 100 ? 'success' : progress > 50 ? 'info' : 'warning'} style={{ height: '5px' }} />
          </div>
        )}
      </div>
    );
  };

  if (milestonesLoading) {
    return <div className="text-center py-5"><div className="spinner-border text-primary" role="status" /></div>;
  }

  return (
    <div>
      <div className={styles.pageHeader} style={{ marginBottom: 'var(--space-4)' }}>
        <div className="d-flex align-items-center gap-2">
          <h2 className={styles.pageTitle} style={{ fontSize: '1.35rem' }}>Activity Schedule</h2>
          <span className={styles.codeChip}>{filtered.length}</span>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <InputGroup style={{ maxWidth: 260 }}>
            <InputGroup.Text className="bg-white"><i className="bi bi-search" /></InputGroup.Text>
            <Form.Control placeholder="Search activities…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </InputGroup>
          <Form.Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ maxWidth: 160 }}>
            <option value="all">All status</option>
            <option value="open">Open</option>
            <option value="reached">Reached</option>
            <option value="closed">Closed</option>
          </Form.Select>
          {canModify && (
            <Button onClick={() => router.push(`/projects/${project.$id}/milestones/new`)}>
              <i className="bi bi-plus-circle me-1" /><span className="d-none d-sm-inline">New Activity</span>
            </Button>
          )}
        </div>
      </div>

      <div className={styles.statGrid}>
        <div className={`${styles.statCard} ${styles.toneTeal}`}><span className={styles.statIcon}><i className="bi bi-flag" /></span><div><div className={styles.statValue}>{stats.total}</div><div className={styles.statLabel}>Total</div></div></div>
        <div className={`${styles.statCard} ${styles.toneBlue}`}><span className={styles.statIcon}><i className="bi bi-flag" /></span><div><div className={styles.statValue}>{stats.open}</div><div className={styles.statLabel}>Open</div></div></div>
        <div className={`${styles.statCard} ${styles.toneGreen}`}><span className={styles.statIcon}><i className="bi bi-flag-fill" /></span><div><div className={styles.statValue}>{stats.reached}</div><div className={styles.statLabel}>Reached</div></div></div>
        <div className={`${styles.statCard} ${styles.toneGrey}`}><span className={styles.statIcon}><i className="bi bi-archive" /></span><div><div className={styles.statValue}>{stats.closed}</div><div className={styles.statLabel}>Closed</div></div></div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-5">
          <i className="bi bi-flag" style={{ fontSize: '2.5rem', color: 'var(--nrep-border)' }} />
          <h5 className="fw-bold mt-3 mb-2">{searchTerm || statusFilter !== 'all' ? 'No activities found' : 'No activities yet'}</h5>
          <p className="text-muted mb-3">{searchTerm || statusFilter !== 'all' ? 'Try adjusting your search or filter.' : 'Create the first activity to track project progress.'}</p>
          {!searchTerm && statusFilter === 'all' && canModify && (
            <Button onClick={() => router.push(`/projects/${project.$id}/milestones/new`)}><i className="bi bi-plus-circle me-2" />Create Activity</Button>
          )}
        </div>
      ) : (
        <div>
          {groups.map(({ root, children }) => (
            <div className={styles.activityGroup} key={root.$id}>
              {children.length > 0 ? (
                <>
                  <div className={styles.activityGroupHeader}>
                    {root.activityCode && <span className={styles.activityCode} style={{ background: 'rgba(255,255,255,0.6)' }}>{root.activityCode}</span>}
                    {root.name}
                  </div>
                  <div className={styles.activityChildren}>
                    <ActivityCard milestone={root} />
                    {children.map((child) => <ActivityCard key={child.$id} milestone={child} />)}
                  </div>
                </>
              ) : (
                <ActivityCard milestone={root} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
