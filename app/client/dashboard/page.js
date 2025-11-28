'use client';

import { useState, useEffect } from 'react';
import { Row, Col, Card, Table, Badge, Alert, Button } from 'react-bootstrap';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { databases, Query, COLLECTIONS, DB_ID } from '@/lib/appwriteClient';
import { formatDate } from '@/lib/date';
import AppLayout from '@/components/AppLayout';
import LoadingSpinner from '@/components/LoadingSpinner';
import ActivityTimeline from '@/components/client/ActivityTimeline';

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
    if (user && user.profile?.clientOrganizationIds) {
      loadClientDashboardData();
    }
  }, [user]);

  const loadClientDashboardData = async () => {
    try {
      setLoading(true);

      // Get client organization IDs
      const clientOrgIds = user.profile.clientOrganizationIds || [];

      if (clientOrgIds.length === 0) {
        setError('No client organizations associated with your account');
        setLoading(false);
        return;
      }

      // Load projects belonging to this client
      const projectsResponse = await databases.listDocuments(
        DB_ID,
        COLLECTIONS.PROJECTS,
        [
          Query.equal('clientId', clientOrgIds),
          Query.orderDesc('$createdAt'),
          Query.limit(100)
        ]
      );
      setProjects(projectsResponse.documents);

      // Calculate project stats
      const total = projectsResponse.documents.length;
      const active = projectsResponse.documents.filter(p => p.status === 'active').length;
      const completed = projectsResponse.documents.filter(p => p.status === 'completed').length;
      const onHold = projectsResponse.documents.filter(p => p.status === 'on_hold').length;
      setStats({ total, active, completed, onHold });

      // Get project IDs for filtering milestones and tasks
      const projectIds = projectsResponse.documents.map(p => p.$id);

      if (projectIds.length > 0) {
        // Load upcoming milestones from client projects
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

        // Load recent visible tasks from client projects
        const tasksResponse = await databases.listDocuments(
          DB_ID,
          COLLECTIONS.TASKS,
          [
            Query.equal('projectId', projectIds),
            Query.equal('isClientVisible', true),
            Query.limit(10),
            Query.orderDesc('$createdAt')
          ]
        );
        setTasks(tasksResponse.documents);

        // Build activity timeline from tasks and milestones
        const recentActivities = [];

        // Add task activities
        tasksResponse.documents.forEach(task => {
          const taskProject = projectsResponse.documents.find(p => p.$id === task.projectId);
          recentActivities.push({
            id: `task-${task.$id}`,
            type: 'task',
            title: task.title,
            status: task.status,
            date: task.$updatedAt || task.$createdAt,
            projectName: taskProject?.name || 'Unknown Project'
          });
        });

        // Add milestone activities
        milestonesResponse.documents.forEach(milestone => {
          const milestoneProject = projectsResponse.documents.find(p => p.$id === milestone.projectId);
          recentActivities.push({
            id: `milestone-${milestone.$id}`,
            type: 'milestone',
            title: milestone.name,
            status: milestone.status,
            date: milestone.$updatedAt || milestone.$createdAt,
            projectName: milestoneProject?.name || 'Unknown Project'
          });
        });

        // Sort by date (most recent first) and limit to 10
        recentActivities.sort((a, b) => new Date(b.date) - new Date(a.date));
        setActivities(recentActivities.slice(0, 10));
      }

    } catch (err) {
      console.error('Client dashboard load error:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <AppLayout user={user}>
        <LoadingSpinner message="Loading your dashboard..." />
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout user={user}>
        <Alert variant="danger">
          <i className="bi bi-exclamation-triangle me-2"></i>
          {error}
        </Alert>
      </AppLayout>
    );
  }

  const getStatusVariant = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'completed': return 'info';
      case 'on_hold': return 'warning';
      case 'cancelled': return 'danger';
      default: return 'secondary';
    }
  };

  const getTaskStatusColor = (status) => {
    const colors = {
      todo: 'secondary',
      in_progress: 'primary',
      blocked: 'danger',
      done: 'success'
    };
    return colors[status] || 'secondary';
  };

  return (
    <AppLayout user={user}>
      {/* Header */}
      <div className="mb-4">
        <h2>Client Dashboard</h2>
        <p className="text-muted">
          Welcome back, {user?.profile?.firstName || user?.name || user?.email}
        </p>
      </div>

      {/* Stats Cards */}
      <Row className="mb-4">
        <Col md={3} className="mb-3">
          <Card className="border-0 shadow-sm text-center h-100">
            <Card.Body>
              <div className="mb-2">
                <i className="bi bi-folder" style={{ fontSize: '2rem', color: '#2563EB' }}></i>
              </div>
              <h3 className="mb-1">{stats.total}</h3>
              <div className="text-muted small">Total Projects</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} className="mb-3">
          <Card className="border-0 shadow-sm text-center h-100">
            <Card.Body>
              <div className="mb-2">
                <i className="bi bi-play-circle" style={{ fontSize: '2rem', color: '#198754' }}></i>
              </div>
              <h3 className="mb-1">{stats.active}</h3>
              <div className="text-muted small">Active Projects</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} className="mb-3">
          <Card className="border-0 shadow-sm text-center h-100">
            <Card.Body>
              <div className="mb-2">
                <i className="bi bi-check-circle" style={{ fontSize: '2rem', color: '#0dcaf0' }}></i>
              </div>
              <h3 className="mb-1">{stats.completed}</h3>
              <div className="text-muted small">Completed</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} className="mb-3">
          <Card className="border-0 shadow-sm text-center h-100">
            <Card.Body>
              <div className="mb-2">
                <i className="bi bi-pause-circle" style={{ fontSize: '2rem', color: '#ffc107' }}></i>
              </div>
              <h3 className="mb-1">{stats.onHold}</h3>
              <div className="text-muted small">On Hold</div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row>
        {/* Your Projects */}
        <Col lg={8} className="mb-4">
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white d-flex justify-content-between align-items-center">
              <h5 className="mb-0">
                <i className="bi bi-folder me-2"></i>
                Your Projects
              </h5>
              <Button
                variant="outline-primary"
                size="sm"
                onClick={() => router.push('/client/projects')}
              >
                View All
              </Button>
            </Card.Header>
            <Card.Body className="p-0">
              {projects.length === 0 ? (
                <div className="text-center py-5">
                  <div className="mb-3">
                    <i className="bi bi-inbox" style={{ fontSize: '3rem', opacity: 0.3 }}></i>
                  </div>
                  <h6>No Projects</h6>
                  <p className="text-muted mb-0">No projects are currently associated with your account</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <Table hover className="mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Code</th>
                        <th>Name</th>
                        <th>Status</th>
                        <th>Timeline</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projects.slice(0, 5).map((project) => (
                        <tr
                          key={project.$id}
                          style={{ cursor: 'pointer' }}
                          onClick={() => router.push(`/client/projects/${project.$id}`)}
                        >
                          <td>
                            <strong className="text-primary">{project.code}</strong>
                          </td>
                          <td>{project.name}</td>
                          <td>
                            <Badge bg={getStatusVariant(project.status)} className="text-uppercase" style={{ fontSize: '0.7rem' }}>
                              {project.status.replace('_', ' ')}
                            </Badge>
                          </td>
                          <td>
                            <small className="text-muted">
                              {project.startDate ? formatDate(project.startDate) : 'Not set'}
                              {project.endDate && ` - ${formatDate(project.endDate)}`}
                            </small>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>

        {/* Upcoming Milestones */}
        <Col lg={4} className="mb-4">
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white">
              <h5 className="mb-0">
                <i className="bi bi-flag me-2"></i>
                Upcoming Milestones
              </h5>
            </Card.Header>
            <Card.Body>
              {milestones.length === 0 ? (
                <div className="text-center py-4">
                  <i className="bi bi-flag" style={{ fontSize: '2rem', opacity: 0.3 }}></i>
                  <p className="text-muted mb-0 mt-2 small">No upcoming milestones</p>
                </div>
              ) : (
                <div>
                  {milestones.map((milestone) => (
                    <div key={milestone.$id} className="mb-3 pb-3 border-bottom">
                      <div className="d-flex justify-content-between align-items-start">
                        <div className="flex-grow-1">
                          <strong className="d-block mb-1">{milestone.name}</strong>
                          <small className="text-muted">
                            <i className="bi bi-calendar me-1"></i>
                            Due: {milestone.dueDate ? formatDate(milestone.dueDate) : 'No date'}
                          </small>
                        </div>
                        <Badge bg="primary" className="text-uppercase" style={{ fontSize: '0.65rem' }}>
                          {milestone.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Activity Timeline */}
      <Row className="mb-4">
        <Col>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white">
              <h5 className="mb-0">
                <i className="bi bi-clock-history me-2"></i>
                Recent Activity
              </h5>
            </Card.Header>
            <Card.Body>
              <ActivityTimeline activities={activities} />
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Recent Tasks */}
      <Row>
        <Col>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white">
              <h5 className="mb-0">
                <i className="bi bi-list-task me-2"></i>
                Recent Visible Tasks
              </h5>
            </Card.Header>
            <Card.Body className="p-0">
              {tasks.length === 0 ? (
                <div className="text-center py-5">
                  <div className="mb-3">
                    <i className="bi bi-list-task" style={{ fontSize: '3rem', opacity: 0.3 }}></i>
                  </div>
                  <h6>No Tasks</h6>
                  <p className="text-muted mb-0">No recent tasks to display</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <Table hover className="mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Task</th>
                        <th>Project</th>
                        <th>Status</th>
                        <th>Due Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tasks.map((task) => {
                        const project = projects.find(p => p.$id === task.projectId);
                        return (
                          <tr key={task.$id}>
                            <td>
                              <strong>{task.title}</strong>
                              {task.description && (
                                <div className="small text-muted text-truncate" style={{ maxWidth: '300px' }}>
                                  {task.description}
                                </div>
                              )}
                            </td>
                            <td>
                              <small className="text-muted">
                                {project ? project.name : 'Unknown'}
                              </small>
                            </td>
                            <td>
                              <Badge bg={getTaskStatusColor(task.status)} className="text-uppercase" style={{ fontSize: '0.7rem' }}>
                                {task.status.replace('_', ' ')}
                              </Badge>
                            </td>
                            <td>
                              <small className="text-muted">
                                {task.dueDate ? formatDate(task.dueDate) : '-'}
                              </small>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </AppLayout>
  );
}
