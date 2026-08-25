'use client';

import { useState, useEffect } from 'react';
import { Row, Col, Card, Alert, Button } from 'react-bootstrap';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { databases, Query, COLLECTIONS, DB_ID } from '@/lib/appwriteClient';
import { formatDate, formatHours, getWeekStart, getWeekEnd } from '@/lib/date';
import AppLayout from '@/components/AppLayout';
import LoadingSpinner from '@/components/LoadingSpinner';
import styles from './dashboard.module.css';

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

  // Dashboard State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Data State
  const [stats, setStats] = useState({});
  const [recentProjects, setRecentProjects] = useState([]);
  const [upcomingMilestones, setUpcomingMilestones] = useState([]);
  const [myTasks, setMyTasks] = useState([]);

  useEffect(() => {
    if (user) {
      loadRoleBasedData();
    }
  }, [user]);

  const loadRoleBasedData = async () => {
    try {
      setLoading(true);
      setError('');

      // 1. Determine Role Scope
      const isAdmin = user.isAdmin;
      const isSupervisor = user.isSupervisor;
      const userId = user.accountId || user.authUser?.$id;
      const projectScope = user.organizationId
        ? [Query.equal('organizationId', user.organizationId)]
        : [];

      const [projectsRes, activeProjectsRes, completedProjectsRes, milestonesRes] = await Promise.all([
        databases.listDocuments(DB_ID, COLLECTIONS.PROJECTS, [
          ...projectScope,
          Query.orderDesc('$createdAt'),
          Query.limit(5),
        ]),
        databases.listDocuments(DB_ID, COLLECTIONS.PROJECTS, [
          ...projectScope,
          Query.equal('status', 'active'),
          Query.limit(1),
        ]),
        databases.listDocuments(DB_ID, COLLECTIONS.PROJECTS, [
          ...projectScope,
          Query.equal('status', 'completed'),
          Query.limit(1),
        ]),
        databases.listDocuments(DB_ID, COLLECTIONS.MILESTONES, [
          Query.equal('status', 'open'),
          Query.limit(5),
          Query.orderAsc('dueDate'),
        ]),
      ]);

      const newStats = {
        totalProjects: projectsRes.total,
        activeProjects: activeProjectsRes.total,
        completedProjects: completedProjectsRes.total,
        openActivities: milestonesRes.total,
      };

      if (isAdmin) {
        const userScope = user.organizationId
          ? [Query.equal('organizationId', user.organizationId)]
          : [];
        const usersRes = await databases.listDocuments(DB_ID, COLLECTIONS.USERS, [
          ...userScope,
          Query.limit(1),
        ]);
        newStats.totalUsers = usersRes.total;
      }

      if (isSupervisor) {
        const teamRes = await databases.listDocuments(DB_ID, COLLECTIONS.USERS, [
          Query.equal('supervisorId', userId),
          Query.limit(1),
        ]);
        newStats.teamSize = teamRes.total;
      }

      if (!isAdmin && !isSupervisor) {
        const myTasksRes = await databases.listDocuments(DB_ID, COLLECTIONS.TASKS, [
          Query.contains('assignedTo', userId),
          Query.notEqual('status', 'done'),
          Query.limit(100),
        ]);

        const orderedTasks = [...myTasksRes.documents].sort((firstTask, secondTask) => {
          const firstDueDate = getDateTimestamp(firstTask.dueDate);
          const secondDueDate = getDateTimestamp(secondTask.dueDate);
          if (firstDueDate === secondDueDate) return 0;
          return firstDueDate - secondDueDate;
        });

        newStats.myOpenTasks = myTasksRes.total;
        setMyTasks(orderedTasks.slice(0, 5));

        try {
          const currentWeekTimesheets = await databases.listDocuments(
            DB_ID,
            COLLECTIONS.TIMESHEETS,
            [
              Query.equal('accountId', userId),
              Query.equal('weekStart', getWeekStart(new Date())),
              Query.limit(1),
            ]
          );

          const currentTimesheet = currentWeekTimesheets.documents[0];
          if (!currentTimesheet) {
            newStats.weeklyHours = 0;
          } else {
            const entriesRes = await databases.listDocuments(
              DB_ID,
              COLLECTIONS.TIMESHEET_ENTRIES,
              [Query.equal('timesheetId', currentTimesheet.$id), Query.limit(500)]
            );

            newStats.weeklyHours = entriesRes.documents.reduce((total, entry) => {
              const hours = Number(entry.hours);
              return Number.isFinite(hours) ? total + hours : total;
            }, 0);
          }
        } catch (timesheetError) {
          console.error('Dashboard weekly hours load error:', timesheetError);
          newStats.weeklyHours = null;
        }
      }

      setStats(newStats);
      setRecentProjects(projectsRes.documents);
      setUpcomingMilestones(milestonesRes.documents);

    } catch (err) {
      console.error('Dashboard load error:', err);
      setError('Some dashboard information could not be loaded. Please refresh and try again.');
    } finally {
      setLoading(false);
    }
  };

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

  if (authLoading || loading) {
    return (
      <AppLayout user={user}>
        <LoadingSpinner message="Loading dashboard..." />
      </AppLayout>
    );
  }

  const projectById = new Map(recentProjects.map(project => [project.$id, project]));
  const hasWeeklyHours = Number.isFinite(stats.weeklyHours);

  // --- RENDER HELPERS ---

  const renderStatsCard = (title, value, icon, tone = 'blue', subtext = null) => (
    <Card className={`h-100 ${styles.statCard} ${STAT_CARD_TONES[tone] || styles.statCardBlue}`}>
      <Card.Body className={styles.statCardBody}>
        <div className={`mb-0 text-uppercase small fw-bold ${styles.statLabel}`}>{title}</div>
        <div className={styles.statIcon} aria-hidden="true">
          <i className={`bi bi-${icon}`}></i>
        </div>
        <div className={`mb-0 fw-bold ${styles.statValue}`}>{value}</div>
        {subtext && <small className={styles.statSubtext}>{subtext}</small>}
      </Card.Body>
    </Card>
  );

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

      {error && (
        <Alert variant="danger" className={styles.errorState} role="alert">
          <i className="bi bi-exclamation-triangle" aria-hidden="true"></i>
          <div>
            <strong>Dashboard data unavailable</strong>
            <span>{error}</span>
          </div>
        </Alert>
      )}

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
            <Col md={4}>{renderStatsCard('Weekly Hours', hasWeeklyHours ? formatHours(stats.weeklyHours) : '—', 'clock', 'blue', hasWeeklyHours ? 'Current Week' : 'Unavailable')}</Col>
            <Col md={4}>{renderStatsCard('Open Tasks', stats.myOpenTasks ?? '—', 'list-check', 'orange')}</Col>
            <Col md={4}>{renderStatsCard('Projects', stats.totalProjects ?? '—', 'folder', 'green', 'Available to You')}</Col>
          </>
        )}
      </Row>

      <Row className="g-4">
        {/* Main Content Area */}
        <Col xl={8}>
          {/* Recent/My Projects */}
          <Card className={`mb-4 ${styles.surfaceCard}`}>
            <Card.Header className={`d-flex justify-content-between align-items-center ${styles.cardHeader}`}>
              <h5 className={`mb-0 fw-bold ${styles.sectionHeading}`}>
                Recent Projects
              </h5>
              <Link href="/projects" className="text-decoration-none small fw-bold">View All <i className="bi bi-arrow-right"></i></Link>
            </Card.Header>
            <Card.Body className="p-0">
              <div className={styles.projectList}>
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
                      <span className={styles.projectRowTop}>
                        <span className={styles.projectIdentity}>
                          <span className={styles.projectIcon} aria-hidden="true">
                            <i className="bi bi-folder"></i>
                          </span>
                          <span className={styles.projectCopy}>
                            <span className={styles.projectName} title={p.name}>{p.name}</span>
                            {p.code && <span className={styles.projectCode}>{p.code}</span>}
                          </span>
                        </span>
                        {p.status && (
                          <span className={`${styles.projectStatus} ${statusClass}`}>
                            {p.status.replaceAll('_', ' ')}
                          </span>
                        )}
                      </span>
                      {(p.startDate || p.endDate) && (
                        <span className={styles.projectDates}>
                          {p.startDate && (
                            <span className={styles.projectDateItem}>
                              <span className={styles.projectDateLabel}>Start</span>
                              <span>{formatDate(p.startDate)}</span>
                            </span>
                          )}
                          {p.endDate && (
                            <span className={styles.projectDateItem}>
                              <span className={styles.projectDateLabel}>Deadline</span>
                              <span>{formatDate(p.endDate)}</span>
                            </span>
                          )}
                        </span>
                      )}
                    </button>
                  );
                })}
                {recentProjects.length === 0 && (
                  <div className={styles.projectEmpty}>
                    <span className={styles.projectEmptyIcon} aria-hidden="true">
                      <i className={`bi ${error ? 'bi-cloud-slash' : 'bi-folder2-open'}`}></i>
                    </span>
                    <h6 className="fw-bold mb-1">{error ? 'Projects unavailable' : 'No recent projects'}</h6>
                    <p className="mb-0">{error ? 'Refresh the page to try loading projects again.' : 'Projects available to you will appear here.'}</p>
                    {!error && user?.isAdmin && (
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
                {myTasks.length > 0 ? (
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
                    <i className={`bi ${error ? 'bi-cloud-slash' : 'bi-check2-circle'} d-block mb-2 ${styles.emptyStateIcon}`} aria-hidden="true"></i>
                    <span>{error ? 'Tasks are unavailable right now.' : 'All caught up! No open tasks.'}</span>
                  </div>
                )}
              </Card.Body>
            </Card>
          )}
        </Col>

        {/* Sidebar Area */}
        <Col xl={4}>
          {/* Upcoming Milestones */}
          <Card className={`mb-4 ${styles.surfaceCard}`}>
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
              {upcomingMilestones.length === 0 && (
                <div className={styles.activityEmpty}>
                  {error ? 'Activity schedule is unavailable right now.' : 'No upcoming milestones.'}
                </div>
              )}
            </Card.Body>
          </Card>

          {/* Quick Links Card - Customized by Role */}
          <Card className={`${styles.surfaceCard} ${styles.quickActionsCard}`}>
            <Card.Body className={styles.quickActionsBody}>
              <h5 className={`fw-bold mb-3 ${styles.sectionHeading}`}>Quick Actions</h5>
              <div className={styles.quickActionList}>
                <Button variant="light" className={`text-start fw-medium ${styles.quickActionButton}`} onClick={() => router.push('/projects')}>
                  <span className={styles.quickActionIcon} aria-hidden="true"><i className="bi bi-folder"></i></span>
                  <span>Browse Projects</span>
                  <i className={`bi bi-chevron-right ${styles.quickActionArrow}`} aria-hidden="true"></i>
                </Button>
                {(user?.isAdmin || user?.isSupervisor) && (
                  <Button variant="light" className={`text-start fw-medium ${styles.quickActionButton}`} onClick={() => router.push('/timesheets/team')}>
                    <span className={styles.quickActionIcon} aria-hidden="true"><i className="bi bi-people"></i></span>
                    <span>Review Timesheets</span>
                    <i className={`bi bi-chevron-right ${styles.quickActionArrow}`} aria-hidden="true"></i>
                  </Button>
                )}
                {(user?.isAdmin) && (
                  <Button variant="light" className={`text-start fw-medium ${styles.quickActionButton}`} onClick={() => router.push('/admin/users')}>
                    <span className={styles.quickActionIcon} aria-hidden="true"><i className="bi bi-gear"></i></span>
                    <span>Manage Users</span>
                    <i className={`bi bi-chevron-right ${styles.quickActionArrow}`} aria-hidden="true"></i>
                  </Button>
                )}
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </AppLayout>
  );
}
