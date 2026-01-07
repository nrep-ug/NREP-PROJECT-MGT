'use client';

import { useState, useEffect } from 'react';
import { Row, Col, Card, Table, Badge, Alert } from 'react-bootstrap';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { databases, Query, COLLECTIONS, DB_ID } from '@/lib/appwriteClient';
import { formatDate, formatDateTime } from '@/lib/date';
import AppLayout from '@/components/AppLayout';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [projects, setProjects] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, completed: 0, onHold: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      // No need to check if user is client - the (staff) layout handles that
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Load projects
      const projectsResponse = await databases.listDocuments(
        DB_ID,
        COLLECTIONS.PROJECTS,
        [Query.limit(10), Query.orderDesc('$createdAt')]
      );
      setProjects(projectsResponse.documents);

      // Calculate stats
      const total = projectsResponse.total;
      const active = projectsResponse.documents.filter(p => p.status === 'active').length;
      const completed = projectsResponse.documents.filter(p => p.status === 'completed').length;
      const onHold = projectsResponse.documents.filter(p => p.status === 'on_hold').length;
      setStats({ total, active, completed, onHold });

      // Load upcoming Activity Schedule
      const milestonesResponse = await databases.listDocuments(
        DB_ID,
        COLLECTIONS.MILESTONES,
        [
          Query.equal('status', 'open'),
          Query.limit(5),
          Query.orderAsc('dueDate')
        ]
      );
      setMilestones(milestonesResponse.documents);

    } catch (err) {
      console.error('Dashboard load error:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <AppLayout user={user}>
        <LoadingSpinner message="Loading dashboard..." />
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout user={user}>
        <Alert variant="danger">{error}</Alert>
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

  return (
    <AppLayout user={user}>
      <div className="mb-4">
        <h2>Dashboard</h2>
        <p className="text-muted">Welcome back, {user?.firstName || user?.email}!</p>
      </div>

      {/* Stats Cards */}
      <Row className="mb-4">
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <h3 className="text-primary">{stats.total}</h3>
              <p className="text-muted mb-0">Total Projects</p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <h3 className="text-success">{stats.active}</h3>
              <p className="text-muted mb-0">Active Projects</p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <h3 className="text-info">{stats.completed}</h3>
              <p className="text-muted mb-0">Completed</p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <h3 className="text-warning">{stats.onHold}</h3>
              <p className="text-muted mb-0">On Hold</p>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row>
        {/* Recent Projects */}
        <Col md={8}>
          <Card className="mb-4">
            <Card.Header className="d-flex justify-content-between align-items-center">
              <h5 className="mb-0">Recent Projects</h5>
              <Link href="/projects" className="btn btn-sm btn-outline-primary">
                View All
              </Link>
            </Card.Header>
            <Card.Body>
              {projects.length === 0 ? (
                <p className="text-muted text-center py-3">No projects yet</p>
              ) : (
                <Table hover responsive>
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Name</th>
                      <th>Status</th>
                      <th>Start Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map((project) => (
                      <tr key={project.$id}>
                        <td>
                          <Link href={`/projects/${project.$id}`} className="text-decoration-none">
                            <strong>{project.code}</strong>
                          </Link>
                        </td>
                        <td>{project.name}</td>
                        <td>
                          <Badge bg={getStatusVariant(project.status)}>
                            {project.status}
                          </Badge>
                        </td>
                        <td>{project.startDate ? formatDate(project.startDate) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </Col>

        {/* Upcoming Activity Schedules */}
        <Col md={4}>
          <Card>
            <Card.Header>
              <h5 className="mb-0">Upcoming Activity Schedules</h5>
            </Card.Header>
            <Card.Body>
              {milestones.length === 0 ? (
                <p className="text-muted text-center py-3">No upcoming Activity Schedules</p>
              ) : (
                <div>
                  {milestones.map((milestone) => (
                    <div key={milestone.$id} className="mb-3 pb-3 border-bottom">
                      <div className="d-flex justify-content-between align-items-start">
                        <div>
                          <strong>{milestone.name}</strong>
                          <br />
                          <small className="text-muted">
                            Due: {milestone.dueDate ? formatDate(milestone.dueDate) : 'No date'}
                          </small>
                        </div>
                        <Badge bg="primary">{milestone.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </AppLayout>
  );
}
