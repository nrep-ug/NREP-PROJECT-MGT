'use client';

import { useState, useEffect } from 'react';
import { Row, Col, Card, Table, Badge, Alert, ProgressBar, Button } from 'react-bootstrap';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { databases, Query, COLLECTIONS, DB_ID } from '@/lib/appwriteClient';
import { formatDate, getWeekStart, getWeekEnd } from '@/lib/date';
import AppLayout from '@/components/AppLayout';
import LoadingSpinner from '@/components/LoadingSpinner';

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
  const [timesheetStatus, setTimesheetStatus] = useState(null);

  useEffect(() => {
    if (user) {
      loadRoleBasedData();
    }
  }, [user]);

  const loadRoleBasedData = async () => {
    try {
      setLoading(true);

      // 1. Determine Role Scope
      const isAdmin = user.isAdmin;
      const isSupervisor = user.isSupervisor;
      const userId = user.accountId || user.authUser?.$id; // Fix: use correct ID property

      // Common: Load Projects (filtered by permission internally by Appwrite usually, or we filter)
      // For Admin: All Projects
      // For Staff: Assigned Projects

      // We'll use parallel fetching for efficiency
      const promises = [];

      // --- ADMIN VIEW DATA ---
      if (isAdmin) {
        // Total Projects
        promises.push(databases.listDocuments(DB_ID, COLLECTIONS.PROJECTS, [Query.limit(10), Query.orderDesc('$createdAt')]));
        // Total Users (Approximate or via API if needed, standard list for now)
        promises.push(databases.listDocuments(DB_ID, COLLECTIONS.USERS, [Query.limit(1)])); // Just for total count
        // Timesheets Pending (Approx via API/DB) - Let's skip heavy agg for now, stick to basic counts
      }
      // --- SUPERVISOR VIEW DATA ---
      else if (isSupervisor) {
        // Projects where I am maybe a manager? Or just organization projects? 
        // For now showing Org projects
        promises.push(databases.listDocuments(DB_ID, COLLECTIONS.PROJECTS, [Query.limit(10), Query.orderDesc('$createdAt')]));
        // My Team (Supervised Users)
        promises.push(databases.listDocuments(DB_ID, COLLECTIONS.USERS, [Query.equal('supervisedBy', userId)]));
      }
      // --- STAFF VIEW DATA ---
      else {
        // My assigned projects (filter by projectIds or similar)
        // Since we don't have easy 'my projects' filter in projects collection without team check, 
        // we might just list all visible projects for now or rely on client side filter if list is small.
        // Better: Use `projectIds` from user profile if available, else list all.
        // Let's list all for now but label "My Projects" if we can filter.
        promises.push(databases.listDocuments(DB_ID, COLLECTIONS.PROJECTS, [Query.limit(10), Query.orderDesc('$createdAt')]));

        // My Tasks
        promises.push(databases.listDocuments(DB_ID, COLLECTIONS.TASKS, [
          Query.equal('assigneeId', userId),
          Query.equal('status', ['todo', 'in_progress']),
          Query.limit(5),
          Query.orderAsc('dueDate')
        ]));
      }

      // Execute fetches
      // Note: This is simplified. Robust impl might need specialized API routes for accurate counts.
      const projectsRes = await databases.listDocuments(DB_ID, COLLECTIONS.PROJECTS, [Query.limit(100)]); // Fetch more to calc stats locally

      // Calculate Stats Locally for now (Client Side Aggregation for speed on small data)
      const allProjects = projectsRes.documents;

      const newStats = {
        totalProjects: projectsRes.total,
        activeProjects: allProjects.filter(p => p.status === 'active').length,
        completedProjects: allProjects.filter(p => p.status === 'completed').length,
      };

      if (isAdmin) {
        // Admin specific fetch users count
        const usersRes = await databases.listDocuments(DB_ID, COLLECTIONS.USERS, [Query.limit(1)]);
        newStats.totalUsers = usersRes.total;

        // Pending Timesheets (Mock or Fetch)
        // Using a known query if field exists, else placeholder
        // newStats.pendingTimesheets = ...
      }

      if (isSupervisor) {
        // Supervisor Stats
        const teamRes = await databases.listDocuments(DB_ID, COLLECTIONS.USERS, [Query.equal('supervisedBy', userId)]);
        newStats.teamSize = teamRes.total;
      }

      if (!isAdmin && !isSupervisor) {
        // Staff Personal Stats
        const myTasksRes = await databases.listDocuments(DB_ID, COLLECTIONS.TASKS, [
          Query.equal('assigneeId', userId),
          Query.notEqual('status', 'done'),
          Query.limit(100)
        ]);
        newStats.myOpenTasks = myTasksRes.total;
        setMyTasks(myTasksRes.documents.slice(0, 5));
      }

      setStats(newStats);
      setRecentProjects(allProjects.slice(0, 5));

      // Load Milestones (Common)
      const milestonesRes = await databases.listDocuments(
        DB_ID,
        COLLECTIONS.MILESTONES,
        [Query.equal('status', 'open'), Query.limit(5), Query.orderAsc('dueDate')]
      );
      setUpcomingMilestones(milestonesRes.documents);

    } catch (err) {
      console.error('Dashboard load error:', err);
      setError('Failed to load dashboard data');
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

  // --- RENDER HELPERS ---

  const renderStatsCard = (title, value, icon, color = 'primary', subtext = null) => (
    <Card className="border-0 shadow-sm h-100">
      <Card.Body className="d-flex align-items-center">
        <div className={`rounded-circle bg-${color}-subtle d-flex align-items-center justify-content-center me-3`} style={{ width: '56px', height: '56px' }}>
          <i className={`bi bi-${icon} text-${color} fs-3`}></i>
        </div>
        <div>
          <h6 className="text-muted mb-1 text-uppercase small fw-bold">{title}</h6>
          <h2 className="mb-0 fw-bold">{value}</h2>
          {subtext && <small className="text-muted">{subtext}</small>}
        </div>
      </Card.Body>
    </Card>
  );

  return (
    <AppLayout user={user}>
      {/* Header Section */}
      <div className="mb-4">
        <Row className="align-items-center">
          <Col>
            <h2 className="fw-bold mb-1">{getGreeting()}, {user?.firstName || 'User'}!</h2>
            <div className="d-flex align-items-center text-muted">
              <span className="me-3"><i className="bi bi-calendar3 me-1"></i> {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
              <Badge bg="light" text="dark" className="border fw-normal">
                <i className="bi bi-person-badge me-1"></i> {getUserRoleLabel()}
              </Badge>
            </div>
          </Col>
          <Col xs="auto">
            {/* Quick Actions */}
            <div className="d-flex gap-2">
              {user?.isAdmin ? (
                <Button variant="primary" size="sm" onClick={() => router.push('/projects/new')}>
                  <i className="bi bi-plus-lg me-1"></i> New Project
                </Button>
              ) : (
                <Button variant="primary" size="sm" onClick={() => {
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
            <Col md={3}>{renderStatsCard('Total Projects', stats.totalProjects, 'folder', 'primary')}</Col>
            <Col md={3}>{renderStatsCard('Active Projects', stats.activeProjects, 'play-circle', 'success')}</Col>
            <Col md={3}>{renderStatsCard('Total Users', stats.totalUsers || '-', 'people', 'info')}</Col>
            <Col md={3}>{renderStatsCard('System Status', 'Healthy', 'hdd-network', 'success')}</Col>
          </>
        )}

        {/* Supervisor Stats */}
        {user?.isSupervisor && !user?.isAdmin && (
          <>
            <Col md={4}>{renderStatsCard('My Team', stats.teamSize || 0, 'people', 'info', 'Staff Members')}</Col>
            <Col md={4}>{renderStatsCard('Active Projects', stats.activeProjects, 'folder', 'primary')}</Col>
            <Col md={4}>{renderStatsCard('Action Items', '0', 'bell', 'warning', 'Pending Approvals')}</Col>
          </>
        )}

        {/* Staff Stats */}
        {!user?.isAdmin && !user?.isSupervisor && (
          <>
            <Col md={4}>{renderStatsCard('Weekly Hours', '0h', 'clock', 'primary', 'Current Week')}</Col>
            <Col md={4}>{renderStatsCard('Open Tasks', stats.myOpenTasks || 0, 'list-check', 'warning')}</Col>
            <Col md={4}>{renderStatsCard('My Projects', recentProjects.length, 'folder', 'info')}</Col>
          </>
        )}
      </Row>

      <Row className="g-4">
        {/* Main Content Area */}
        <Col lg={8}>
          {/* Recent/My Projects */}
          <Card className="border-0 shadow-sm mb-4">
            <Card.Header className="bg-white py-3 d-flex justify-content-between align-items-center">
              <h5 className="mb-0 fw-bold">
                {user?.isAdmin ? 'Recent Projects' : 'My Active Projects'}
              </h5>
              <Link href="/projects" className="text-decoration-none small fw-bold">View All <i className="bi bi-arrow-right"></i></Link>
            </Card.Header>
            <Card.Body className="p-0">
              <Table hover responsive className="mb-0 align-middle">
                <thead className="bg-light">
                  <tr>
                    <th className="ps-4 border-0">Project Info</th>
                    <th className="border-0">Status</th>
                    <th className="pe-4 border-0 text-end">Start Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentProjects.map(p => (
                    <tr key={p.$id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/projects/${p.$id}`)}>
                      <td className="ps-4 py-3">
                        <div className="d-flex align-items-center">
                          <div className="rounded bg-light d-flex align-items-center justify-content-center me-3" style={{ width: '40px', height: '40px' }}>
                            <i className="bi bi-folder text-muted"></i>
                          </div>
                          <div>
                            <div className="fw-bold text-dark">{p.name}</div>
                            <div className="small text-muted">{p.code}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <Badge bg={
                          p.status === 'active' ? 'success' :
                            p.status === 'completed' ? 'info' :
                              p.status === 'planning' ? 'warning' : 'secondary'
                        } className="fw-normal px-2 py-1">
                          {p.status}
                        </Badge>
                      </td>
                      <td className="pe-4 text-end text-muted small">
                        {p.startDate ? formatDate(p.startDate) : '-'}
                      </td>
                    </tr>
                  ))}
                  {recentProjects.length === 0 && (
                    <tr>
                      <td colSpan="3" className="text-center py-4 text-muted">No projects found.</td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </Card.Body>
          </Card>

          {/* Staff Only: My Tasks */}
          {!user?.isAdmin && !user?.isSupervisor && (
            <Card className="border-0 shadow-sm">
              <Card.Header className="bg-white py-3">
                <h5 className="mb-0 fw-bold">Upcoming Tasks</h5>
              </Card.Header>
              <Card.Body>
                {myTasks.length > 0 ? (
                  myTasks.map(task => (
                    <div key={task.$id} className="d-flex align-items-center border-bottom py-2">
                      <i className="bi bi-circle text-muted me-3"></i>
                      <div className="flex-grow-1">
                        <div className="fw-medium">{task.title}</div>
                        <div className="small text-muted">{task.dueDate ? `Due: ${formatDate(task.dueDate)}` : 'No due date'}</div>
                      </div>
                      <Badge bg="light" text="dark" className="border">To Do</Badge>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-3 text-muted">
                    <i className="bi bi-check2-circle fs-3 d-block mb-2"></i>
                    All caught up! No open tasks.
                  </div>
                )}
              </Card.Body>
            </Card>
          )}
        </Col>

        {/* Sidebar Area */}
        <Col lg={4}>
          {/* Upcoming Milestones */}
          <Card className="border-0 shadow-sm mb-4">
            <Card.Header className="bg-white py-3">
              <h5 className="mb-0 fw-bold">Activity Schedule</h5>
            </Card.Header>
            <Card.Body>
              {upcomingMilestones.slice(0, 4).map(m => (
                <div key={m.$id} className="d-flex mb-3">
                  <div className="me-3 text-center">
                    <div className="fw-bold text-primary" style={{ fontSize: '1.1rem' }}>{m.dueDate ? new Date(m.dueDate).getDate() : '-'}</div>
                    <div className="small text-muted text-uppercase" style={{ fontSize: '0.7rem' }}>{m.dueDate ? new Date(m.dueDate).toLocaleString('default', { month: 'short' }) : ''}</div>
                  </div>
                  <div>
                    <div className="fw-bold">{m.name}</div>
                    <div className="small text-muted text-truncate" style={{ maxWidth: '180px' }}>{m.description || 'No description'}</div>
                  </div>
                </div>
              ))}
              {upcomingMilestones.length === 0 && (
                <div className="text-muted small">No upcoming milestones.</div>
              )}
            </Card.Body>
          </Card>

          {/* Quick Links Card - Customized by Role */}
          <Card className="border-0 shadow-sm bg-primary text-white">
            <Card.Body>
              <h5 className="fw-bold mb-3">Quick Actions</h5>
              <div className="d-grid gap-2">
                <Button variant="light" className="text-start text-primary fw-medium" onClick={() => router.push('/projects')}>
                  <i className="bi bi-folder me-2"></i> Browse Projects
                </Button>
                {(user?.isAdmin || user?.isSupervisor) && (
                  <Button variant="light" className="text-start text-primary fw-medium bg-white bg-opacity-90" onClick={() => router.push('/timesheets/team')}>
                    <i className="bi bi-people me-2"></i> Review Timesheets
                  </Button>
                )}
                {(user?.isAdmin) && (
                  <Button variant="light" className="text-start text-primary fw-medium bg-white bg-opacity-75" onClick={() => router.push('/admin/users')}>
                    <i className="bi bi-gear me-2"></i> Manage Users
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
