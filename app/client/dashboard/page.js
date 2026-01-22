'use client';

import { useState, useEffect } from 'react';
import { Row, Col, Card, Table, Badge, Alert, Button, ProgressBar } from 'react-bootstrap';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { databases, Query, COLLECTIONS, DB_ID } from '@/lib/appwriteClient';
import { formatDate } from '@/lib/date';
import AppLayout from '@/components/AppLayout';
import LoadingSpinner from '@/components/LoadingSpinner';
import ActivityTimeline from '@/components/client/ActivityTimeline';
import Toast, { useToast } from '@/components/Toast';

export default function ClientDashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [projects, setProjects] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [activities, setActivities] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, completed: 0, onHold: 0 });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Only load if user is client and has orgs
    if (user && user.profile?.clientOrganizationIds) {
      loadClientDashboardData();
    } else if (user && !user.profile?.clientOrganizationIds && !authLoading) {
      setLoading(false);
    }
  }, [user, authLoading]);

  const loadClientDashboardData = async () => {
    try {
      setLoading(true);

      const clientOrgIds = user.profile.clientOrganizationIds || [];
      if (clientOrgIds.length === 0) {
        setLoading(false);
        return;
      }

      // 1. Projects
      // Filtering strictly by clientId
      const projectsResponse = await databases.listDocuments(
        DB_ID,
        COLLECTIONS.PROJECTS,
        [
          Query.equal('clientId', clientOrgIds),
          Query.orderDesc('$createdAt'),
          Query.limit(10) // Limit to 10 for dashboard
        ]
      );
      setProjects(projectsResponse.documents);

      // Stats Calculation (Local for now based on fetched docs, more robust if fetch all ids only?)
      // Ideally we should fetch counts via dedicated query if list is large.
      // For now using the fetched docs.
      const total = projectsResponse.total; // Appwrite returns total found
      // Note: calculated stats based on `documents` might be inaccurate if > limit. 
      // Should ideally fetch counts separately or assumedashboard view.
      // Let's rely on total property for count, but status breakdown on fetched docs is partial.
      // Let's accept partial stats for dashboard or fetch all for stats.
      // Trying to fetch all for accurate stats if not too many.
      // Actually, let's just stick to the limited set for now to avoid perf hit.
      const displayedProjects = projectsResponse.documents;
      setStats({
        total: total,
        active: displayedProjects.filter(p => p.status === 'active').length,
        completed: displayedProjects.filter(p => p.status === 'completed').length,
        onHold: displayedProjects.filter(p => p.status === 'on_hold').length
      });

      const projectIds = displayedProjects.map(p => p.$id);

      if (projectIds.length > 0) {
        // 2. Milestones (Open)
        const milestonesResponse = await databases.listDocuments(
          DB_ID,
          COLLECTIONS.MILESTONES,
          [
            Query.equal('projectId', projectIds),
            Query.equal('status', 'open'),
            Query.limit(5),
            Query.orderAsc('dueDate')
          ]
        );
        setMilestones(milestonesResponse.documents);

        // 3. Client Visible Tasks
        const tasksResponse = await databases.listDocuments(
          DB_ID,
          COLLECTIONS.TASKS,
          [
            Query.equal('projectId', projectIds),
            Query.equal('isClientVisible', true),
            Query.limit(5),
            Query.orderDesc('$createdAt')
          ]
        );
        setTasks(tasksResponse.documents);

        // 4. Activities (Simplified Builder)
        // Combining tasks and milestones for timeline
        const recentActivities = [];
        tasksResponse.documents.forEach(task => {
          const proj = displayedProjects.find(p => p.$id === task.projectId);
          recentActivities.push({
            id: task.$id, type: 'task', title: task.title, status: task.status,
            date: task.$createdAt, projectName: proj?.name
          });
        });
        milestonesResponse.documents.forEach(m => {
          const proj = displayedProjects.find(p => p.$id === m.projectId);
          recentActivities.push({
            id: m.$id, type: 'milestone', title: m.name, status: m.status,
            date: m.$createdAt, projectName: proj?.name // Using created for "Recent Activity" feed usually
          });
        });
        recentActivities.sort((a, b) => new Date(b.date) - new Date(a.date));
        setActivities(recentActivities.slice(0, 5));
      }

    } catch (err) {
      console.error('Client dashboard error:', err);
      // Fail silently on dashboard usually better than blocking error
    } finally {
      setLoading(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    return hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';
  };

  const getStatusVariant = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'completed': return 'info';
      case 'on_hold': return 'warning';
      default: return 'secondary';
    }
  };

  if (authLoading || loading) {
    return (
      <AppLayout user={user}>
        <LoadingSpinner message="Loading your dashboard..." />
      </AppLayout>
    );
  }

  return (
    <AppLayout user={user}>
      {/* Hero Header */}
      <Card className="border-0 shadow-sm mb-4 overflow-hidden" style={{ borderRadius: '16px' }}>
        <div style={{
          background: 'linear-gradient(135deg, #054653 0%, #14B8A6 100%)',
          padding: '2rem',
          color: 'white'
        }}>
          <Row className="align-items-center">
            <Col md={8}>
              <h2 className="fw-bold mb-2">{getGreeting()}, {user?.firstName}!</h2>
              <p className="mb-0 opacity-90" style={{ fontSize: '1.1rem' }}>
                Here is what's happening with your projects today.
              </p>
            </Col>
            <Col md={4} className="text-end d-none d-md-block">
              <div className="bg-white bg-opacity-25 rounded-3 p-3 d-inline-block text-start" style={{ minWidth: '200px' }}>
                <small className="text-uppercase fw-bold opacity-75" style={{ fontSize: '0.7rem' }}>Active Projects</small>
                <div className="fs-1 fw-bold lh-1">{stats.active}</div>
              </div>
            </Col>
          </Row>
        </div>
      </Card>

      {/* Main Stats Row */}
      <Row className="g-4 mb-4">
        {[{ label: 'Total Projects', value: stats.total, icon: 'folder', color: 'primary' },
        { label: 'Completed', value: stats.completed, icon: 'check-circle', color: 'info' },
        { label: 'Pending Milestones', value: milestones.length, icon: 'flag', color: 'warning' }
        ].map((stat, idx) => (
          <Col key={idx} md={4}>
            <Card className="border-0 shadow-sm h-100" style={{ borderRadius: '12px' }}>
              <Card.Body className="d-flex align-items-center p-4">
                <div className={`rounded-circle bg-${stat.color}-subtle d-flex align-items-center justify-content-center me-3`}
                  style={{ width: '60px', height: '60px' }}>
                  <i className={`bi bi-${stat.icon} text-${stat.color} fs-3`}></i>
                </div>
                <div>
                  <div className="text-muted small fw-bold text-uppercase">{stat.label}</div>
                  <h3 className="mb-0 fw-bold">{stat.value}</h3>
                </div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      <Row className="g-4">
        <Col lg={8}>
          {/* Projects List */}
          <Card className="border-0 shadow-sm mb-4" style={{ borderRadius: '12px' }}>
            <Card.Header className="bg-white py-3 d-flex justify-content-between align-items-center">
              <h5 className="mb-0 fw-bold"><i className="bi bi-folder-check me-2 text-primary"></i>Active Projects</h5>
              <Button variant="outline-primary" size="sm" onClick={() => router.push('/client/projects')}>View All</Button>
            </Card.Header>
            <Card.Body className="p-0">
              {projects.length > 0 ? (
                <div className="table-responsive">
                  <Table hover className="mb-0 align-middle">
                    <thead className="bg-light">
                      <tr>
                        <th className="ps-4 border-0">Project</th>
                        <th className="border-0">Status</th>
                        <th className="pe-4 border-0 text-end">Timeline</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projects.slice(0, 5).map(p => (
                        <tr key={p.$id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/client/projects/${p.$id}`)}>
                          <td className="ps-4 py-3">
                            <div className="fw-bold text-dark">{p.name}</div>
                            <div className="small text-muted">{p.code}</div>
                          </td>
                          <td><Badge bg={getStatusVariant(p.status)} className="px-2 py-1 fw-normal text-uppercase" style={{ fontSize: '0.7rem' }}>{p.status}</Badge></td>
                          <td className="pe-4 text-end text-muted small">
                            {p.startDate ? formatDate(p.startDate) : 'TBD'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-5 text-muted">
                  <i className="bi bi-folder-x fs-1 opacity-25"></i>
                  <p className="mt-2">No active projects found.</p>
                </div>
              )}
            </Card.Body>
          </Card>

          {/* Recent Tasks */}
          {tasks.length > 0 && (
            <Card className="border-0 shadow-sm" style={{ borderRadius: '12px' }}>
              <Card.Header className="bg-white py-3">
                <h5 className="mb-0 fw-bold"><i className="bi bi-list-check me-2 text-success"></i>Recent Updates</h5>
              </Card.Header>
              <Card.Body>
                {tasks.slice(0, 3).map(task => (
                  <div key={task.$id} className="d-flex align-items-center border-bottom py-3 last-no-border">
                    <i className="bi bi-check-circle text-muted me-3"></i>
                    <div className="flex-grow-1">
                      <div className="fw-medium">{task.title}</div>
                      <div className="small text-muted">
                        Updated {new Date(task.$updatedAt).toLocaleDateString()} &bull;
                        <span className="ms-1">{projects.find(p => p.$id === task.projectId)?.code}</span>
                      </div>
                    </div>
                    <Badge bg="light" text="dark" className="border">Active</Badge>
                  </div>
                ))}
              </Card.Body>
            </Card>
          )}
        </Col>

        <Col lg={4}>
          {/* Timeline / Milestones */}
          <Card className="border-0 shadow-sm mb-4" style={{ borderRadius: '12px' }}>
            <Card.Header className="bg-white py-3">
              <h5 className="mb-0 fw-bold">Upcoming Milestones</h5>
            </Card.Header>
            <Card.Body>
              {milestones.length > 0 ? (
                <div className="timeline-widget">
                  {milestones.map((m, idx) => (
                    <div key={m.$id} className="d-flex mb-3 position-relative">
                      <div className="d-flex flex-column align-items-center me-3">
                        <div className={`rounded-circle bg-primary d-flex align-items-center justify-content-center text-white`} style={{ width: '24px', height: '24px', fontSize: '10px' }}>
                          {idx + 1}
                        </div>
                        {idx < milestones.length - 1 && <div className="bg-light mt-1" style={{ width: '2px', flex: 1 }}></div>}
                      </div>
                      <div className="pb-3">
                        <div className="fw-bold mb-1">{m.name}</div>
                        <div className="small text-muted mb-1"><i className="bi bi-calendar me-1"></i> Due: {formatDate(m.dueDate)}</div>
                        <Badge bg="light" text="dark" className="border">{m.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted small">No upcoming milestones driven by your projects.</p>
              )}
            </Card.Body>
          </Card>

          {/* Support Card */}
          <Card className="border-0 shadow-sm bg-light" style={{ borderRadius: '12px' }}>
            <Card.Body className="text-center p-4">
              <div className="rounded-circle bg-white d-inline-flex align-items-center justify-content-center mb-3 shadow-sm" style={{ width: '50px', height: '50px' }}>
                <i className="bi bi-question-lg text-primary fs-4"></i>
              </div>
              <h5>Need Help?</h5>
              <p className="text-muted small mb-3">Contact your project manager for updates or inquiries.</p>
              <Button variant="outline-primary" size="sm" href="mailto:support@nrep.com">Contact Support</Button>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </AppLayout>
  );
}
