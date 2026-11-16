'use client';

import { Row, Col, Card, Button } from 'react-bootstrap';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useDashboardStats, useMyWork, useRecentProjects, useUpcomingActivities } from '@/hooks/useDashboard';
import { formatDate, formatHours, getWeekStart, getWeekEnd } from '@/lib/date';
import AppLayout from '@/components/AppLayout';
import LoadingSpinner from '@/components/LoadingSpinner';
import styles from './dashboard.module.css';
import ManagerFinanceSnapshot from '@/components/finance/ManagerFinanceSnapshot';

const STAT_CARD_TONES = {
  blue: styles.statCardBlue,
  orange: styles.statCardOrange,
  green: styles.statCardGreen,
  deepBlue: styles.statCardDeepBlue,
};

const TASK_STATUS_LABELS = {
  todo: 'To Do',
  in_progress: 'In Progress',
  blocked: 'Blocked',
};

const TASK_STATUS_ICONS = {
  todo: 'circle',
  in_progress: 'arrow-repeat',
  blocked: 'exclamation-octagon',
};

/** Small, calm "couldn't load" line with a retry — used inside each card. */
function InlineError({ label = 'Couldn’t load this right now.', onRetry, retrying }) {
  return (
    <div className={styles.inlineError} role="status">
      <i className="bi bi-wifi-off" aria-hidden="true"></i>
      <span>{label}</span>
      {onRetry && (
        <button type="button" className={styles.retryButton} onClick={onRetry} disabled={retrying}>
          {retrying ? 'Retrying…' : 'Retry'}
        </button>
      )}
    </div>
  );
}

const getDateTimestamp = (value) => {
  if (!value) return Number.POSITIVE_INFINITY;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
};

const isDateOverdue = (value) => {
  const timestamp = getDateTimestamp(value);
  if (!Number.isFinite(timestamp)) return false;

  const dueDate = new Date(timestamp);
  const today = new Date();
  dueDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return dueDate < today;
};

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  // Each section loads (and retries) independently.
  const statsQuery = useDashboardStats(user);
  const projectsQuery = useRecentProjects(user);
  const activitiesQuery = useUpcomingActivities(user);
  const myWorkQuery = useMyWork(user);

  const myWork = myWorkQuery.data || {};
  const stats = {
    ...(statsQuery.data || {}),
    myOpenTasks: myWork.openTaskCount,
    weeklyHours: myWork.weeklyHours,
  };
  const recentProjects = projectsQuery.data || [];
  const upcomingMilestones = activitiesQuery.data || [];
  const myTasks = myWork.tasks || [];

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getUserRoleLabel = () => {
    if (user?.isAdmin) return 'Administrator';
    if (user?.isSupervisor) return 'Team Supervisor';
    return 'Staff Member';
  };

  if (authLoading) {
    return (
      <AppLayout user={user}>
        <LoadingSpinner message="Loading dashboard..." />
      </AppLayout>
    );
  }

  const projectById = new Map(recentProjects.map(project => [project.$id, project]));
  const hasWeeklyHours = Number.isFinite(stats.weeklyHours);

  // --- RENDER HELPERS ---

  /** query = the TanStack query feeding this card (drives skeleton / retry state). */
  const renderStatsCard = (title, value, icon, tone = 'blue', subtext = null, query = statsQuery) => {
    const isLoading = query.isLoading;
    const isError = query.isError && !query.isFetching;
    return (
      <Card className={`h-100 ${styles.statCard} ${STAT_CARD_TONES[tone] || styles.statCardBlue}`}>
        <Card.Body className={styles.statCardBody}>
          <div className={`mb-0 text-uppercase small fw-bold ${styles.statLabel}`}>{title}</div>
          <div className={styles.statIcon} aria-hidden="true">
            <i className={`bi bi-${icon}`}></i>
          </div>
          <div className={`mb-0 fw-bold ${styles.statValue}`}>
            {isLoading ? <span className={styles.skeleton} aria-label="Loading" /> : (value ?? '—')}
          </div>
          {isError ? (
            <button type="button" className={`${styles.statSubtext} ${styles.retryLink}`} onClick={() => query.refetch()}>
              <i className="bi bi-arrow-clockwise me-1" aria-hidden="true"></i>Couldn’t load — retry
            </button>
          ) : (
            subtext && <small className={styles.statSubtext}>{subtext}</small>
          )}
        </Card.Body>
      </Card>
    );
  };

  return (
    <AppLayout user={user}>
      {/* Header Section */}
      <div className={`mb-4 ${styles.pageHeader}`}>
        <Row className="align-items-center">
          <Col xs={12} sm>
            <h2 className={`fw-bold mb-1 ${styles.pageTitle}`}>{getGreeting()}, {user?.firstName || 'User'}!</h2>
            <div className={styles.pageMeta}>
              <span><i className="bi bi-calendar3 me-1" aria-hidden="true"></i> {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
              <span className={styles.metaDivider} aria-hidden="true">•</span>
              <span><i className="bi bi-person-badge me-1" aria-hidden="true"></i> {getUserRoleLabel()}</span>
            </div>
          </Col>
          <Col xs={12} sm="auto" className={styles.headerActions}>
            {/* Quick Actions */}
            <div className="d-flex gap-2">
              {user?.isAdmin ? (
                <Button variant="primary" size="sm" onClick={() => router.push('/projects/new')}>
                  <i className="bi bi-plus-lg me-1"></i> New Project
                </Button>
              ) : (
                <Button variant="primary" size="sm" className={styles.logTimeButton} onClick={() => {
                  const weekStart = getWeekStart(new Date());
                  const weekEnd = getWeekEnd(weekStart);
                  const params = new URLSearchParams({ weekStart, weekEnd });
                  router.push(`/timesheets/entry?${params.toString()}`);
                }}>
                  <i className="bi bi-clock me-1"></i> Log Time
                </Button>
              )}
            </div>
          </Col>
        </Row>
      </div>

      {/* Role-Based Stats Row */}
      <Row className="g-4 mb-4">
        {/* Admin Stats */}
        {user?.isAdmin && (
          <>
            <Col sm={6} xl={3}>{renderStatsCard('Total Projects', stats.totalProjects ?? '—', 'folder', 'blue')}</Col>
            <Col sm={6} xl={3}>{renderStatsCard('Active Projects', stats.activeProjects ?? '—', 'play-circle', 'green')}</Col>
            <Col sm={6} xl={3}>{renderStatsCard('Total Users', stats.totalUsers ?? '—', 'people', 'deepBlue')}</Col>
            <Col sm={6} xl={3}>{renderStatsCard('Completed Projects', stats.completedProjects ?? '—', 'check2-circle', 'green')}</Col>
          </>
        )}

        {/* Supervisor Stats */}
        {user?.isSupervisor && !user?.isAdmin && (
          <>
            <Col md={4}>{renderStatsCard('My Team', stats.teamSize ?? '—', 'people', 'deepBlue', 'Staff Members')}</Col>
            <Col md={4}>{renderStatsCard('Active Projects', stats.activeProjects ?? '—', 'folder', 'blue')}</Col>
            <Col md={4}>{renderStatsCard('Open Activities', stats.openActivities ?? '—', 'calendar-event', 'orange', 'Scheduled')}</Col>
          </>
        )}

        {/* Staff Stats */}
        {!user?.isAdmin && !user?.isSupervisor && (
          <>
            <Col md={4}>{renderStatsCard('Weekly Hours', hasWeeklyHours ? formatHours(stats.weeklyHours) : '—', 'clock', 'blue', hasWeeklyHours ? 'Current Week' : 'Unavailable', myWorkQuery)}</Col>
            <Col md={4}>{renderStatsCard('Open Tasks', stats.myOpenTasks, 'list-check', 'orange', null, myWorkQuery)}</Col>
            <Col md={4}>{renderStatsCard('Projects', stats.totalProjects ?? '—', 'folder', 'green', 'Available to You')}</Col>
          </>
        )}
      </Row>

      <ManagerFinanceSnapshot user={user} />

      <section className={styles.quickStrip} aria-labelledby="quick-actions-title">
        <h2 id="quick-actions-title" className={styles.quickStripTitle}>Quick actions</h2>
        <div className={styles.quickStripButtons}>
          <button type="button" className={styles.quickPill} onClick={() => router.push('/projects')}>
            <span className={styles.quickPillIcon} aria-hidden="true"><i className="bi bi-folder" /></span>Browse projects
          </button>
          {(user?.isAdmin || user?.isSupervisor) && (
            <button type="button" className={styles.quickPill} onClick={() => router.push('/timesheets/team')}>
              <span className={styles.quickPillIcon} aria-hidden="true"><i className="bi bi-people" /></span>Review timesheets
            </button>
          )}
          {user?.isAdmin && (
            <button type="button" className={styles.quickPill} onClick={() => router.push('/admin/users')}>
              <span className={styles.quickPillIcon} aria-hidden="true"><i className="bi bi-gear" /></span>Manage users
            </button>
          )}
        </div>
      </section>

      <Row className="g-4 align-items-stretch">
        {/* Main Content Area */}
        <Col xl={8} className={styles.stackCol}>
          {/* Recent/My Projects */}
          <Card className={`${styles.surfaceCard} ${styles.fillCard}`}>
            <Card.Header className={`d-flex justify-content-between align-items-center ${styles.cardHeader}`}>
              <h5 className={`mb-0 fw-bold ${styles.sectionHeading}`}>
                Recent Projects
              </h5>
              <Link href="/projects" className="text-decoration-none small fw-bold">View All <i className="bi bi-arrow-right"></i></Link>
            </Card.Header>
            <Card.Body className="p-0">
              <div className={styles.projectList}>
                {recentProjects.length > 0 && (
                  <div className={styles.projectHead} aria-hidden="true">
                    <span>Project</span><span>Start</span><span>Deadline</span><span>Status</span>
                  </div>
                )}
                {recentProjects.map(p => {
                  const statusClass = p.status === 'active' ? styles.projectStatusActive :
                    p.status === 'completed' ? styles.projectStatusCompleted :
                      (p.status === 'planned' || p.status === 'planning') ? styles.projectStatusPlanned :
                        p.status === 'on_hold' ? styles.projectStatusOnHold :
                          p.status === 'cancelled' ? styles.projectStatusCancelled : styles.projectStatusNeutral;

                  return (
                    <button
                      key={p.$id}
                      type="button"
                      className={styles.projectRow}
                      onClick={() => router.push(`/projects/${p.$id}`)}
                    >
                      <span className={styles.projectIdentity}>
                        <span className={styles.projectIcon} aria-hidden="true">
                          <i className="bi bi-folder"></i>
                        </span>
                        <span className={styles.projectCopy}>
                          <span className={styles.projectName} title={p.name}>{p.name}</span>
                          {p.code && <span className={styles.projectCode}>{p.code}</span>}
                        </span>
                      </span>
                      <span className={styles.projectDateCell}>
                        <span className={styles.projectDateLabel}>Start</span>
                        {p.startDate ? formatDate(p.startDate) : '—'}
                      </span>
                      <span className={styles.projectDateCell}>
                        <span className={styles.projectDateLabel}>Deadline</span>
                        {p.endDate ? formatDate(p.endDate) : '—'}
                      </span>
                      <span className={styles.projectStatusCell}>
                        {p.status && (
                          <span className={`${styles.projectStatus} ${statusClass}`}>
                            {p.status.replaceAll('_', ' ')}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
                {projectsQuery.isLoading && <div className={styles.listSkeleton}><span className={styles.skeleton} /><span className={styles.skeleton} /><span className={styles.skeleton} /></div>}
                {recentProjects.length === 0 && !projectsQuery.isLoading && (
                  <div className={styles.projectEmpty}>
                    <span className={styles.projectEmptyIcon} aria-hidden="true">
                      <i className={`bi ${projectsQuery.isError ? 'bi-cloud-slash' : 'bi-folder2-open'}`}></i>
                    </span>
                    <h6 className="fw-bold mb-1">{projectsQuery.isError ? 'Projects unavailable' : 'No recent projects'}</h6>
                    {projectsQuery.isError ? (
                      <InlineError label="The server was slow to answer." onRetry={() => projectsQuery.refetch()} retrying={projectsQuery.isFetching} />
                    ) : (
                      <p className="mb-0">Projects available to you will appear here.</p>
                    )}
                    {!projectsQuery.isError && user?.isAdmin && (
                      <Button size="sm" className={styles.projectEmptyAction} onClick={() => router.push('/projects/new')}>
                        <i className="bi bi-plus-lg me-1" aria-hidden="true"></i> New Project
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </Card.Body>
          </Card>

          {/* Staff Only: My Tasks */}
          {!user?.isAdmin && !user?.isSupervisor && (
            <Card className={styles.surfaceCard}>
              <Card.Header className={styles.cardHeader}>
                <h5 className={`mb-0 fw-bold ${styles.sectionHeading}`}>Upcoming Tasks</h5>
              </Card.Header>
              <Card.Body className="p-0">
                {myWorkQuery.isLoading ? (
                  <div className={styles.listSkeleton}><span className={styles.skeleton} /><span className={styles.skeleton} /></div>
                ) : myTasks.length > 0 ? (
                  <div className={styles.taskList}>
                    {myTasks.map(task => {
                      const isOverdue = isDateOverdue(task.dueDate);
                      const projectContext = projectById.get(task.projectId);

                      return (
                        <div key={task.$id} className={styles.taskRow}>
                          <span className={`${styles.taskMarker} ${isOverdue ? styles.taskMarkerOverdue : ''}`} aria-hidden="true">
                            <i className={`bi bi-${TASK_STATUS_ICONS[task.status] || 'circle'}`}></i>
                          </span>
                          <div className={styles.taskCopy}>
                            <div className={styles.taskTitle} title={task.title}>{task.title}</div>
                            <div className={styles.taskSupporting}>
                              <span>{TASK_STATUS_LABELS[task.status] || task.status || 'To Do'}</span>
                              {projectContext && (
                                <span className={styles.taskContext} title={projectContext.name}>
                                  {projectContext.code || projectContext.name}
                                </span>
                              )}
                              {task.priority && (
                                <span className={styles.taskPriority}>
                                  {task.priority} priority
                                </span>
                              )}
                              {isOverdue && <span className={styles.taskOverdue}>Overdue</span>}
                            </div>
                          </div>
                          <div className={`${styles.taskDue} ${isOverdue ? styles.taskDueOverdue : ''}`}>
                            <span>Due</span>
                            <strong>{task.dueDate ? formatDate(task.dueDate) : 'No date'}</strong>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className={`text-center ${styles.emptyState}`}>
                    {myWorkQuery.isError ? (
                      <InlineError label="Tasks couldn’t load." onRetry={() => myWorkQuery.refetch()} retrying={myWorkQuery.isFetching} />
                    ) : (
                      <>
                        <i className={`bi bi-check2-circle d-block mb-2 ${styles.emptyStateIcon}`} aria-hidden="true"></i>
                        <span>All caught up! No open tasks.</span>
                      </>
                    )}
                  </div>
                )}
              </Card.Body>
            </Card>
          )}
        </Col>

        {/* Sidebar Area */}
        <Col xl={4} className={styles.stackCol}>
          {/* Upcoming Milestones */}
          <Card className={`${styles.surfaceCard} ${styles.fillCard}`}>
            <Card.Header className={styles.cardHeader}>
              <h5 className={`mb-0 fw-bold ${styles.sectionHeading}`}>Activity Schedule</h5>
            </Card.Header>
            <Card.Body className={styles.activityBody}>
              <div className={styles.activityTimeline}>
                {upcomingMilestones.slice(0, 4).map(m => {
                  const isOverdue = isDateOverdue(m.dueDate);

                  return (
                    <div key={m.$id} className={styles.activityItem}>
                      <time className={styles.activityDate} dateTime={m.dueDate || undefined}>
                        <span>{m.dueDate ? new Date(m.dueDate).getDate() : '--'}</span>
                        <small>{m.dueDate ? new Date(m.dueDate).toLocaleString('default', { month: 'short' }) : 'TBD'}</small>
                      </time>
                      <span className={styles.activityRail} aria-hidden="true">
                        <span className={`${styles.activityMarker} ${isOverdue ? styles.activityMarkerUrgent : ''}`}></span>
                      </span>
                      <div className={styles.activityCopy}>
                        <div className={styles.activityTitleRow}>
                          <div className={styles.activityTitle} title={m.name}>{m.name}</div>
                          {isOverdue && <span className={styles.activityUrgency}>Overdue</span>}
                        </div>
                        <div className={styles.activityDescription}>{m.description || 'No description'}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {activitiesQuery.isLoading && <div className={styles.listSkeleton}><span className={styles.skeleton} /><span className={styles.skeleton} /></div>}
              {upcomingMilestones.length === 0 && !activitiesQuery.isLoading && (
                <div className={styles.activityEmpty}>
                  {activitiesQuery.isError ? (
                    <InlineError label="Activity schedule couldn’t load." onRetry={() => activitiesQuery.refetch()} retrying={activitiesQuery.isFetching} />
                  ) : 'No upcoming activities.'}
                </div>
              )}
            </Card.Body>
          </Card>

        </Col>
      </Row>
    </AppLayout>
  );
}
