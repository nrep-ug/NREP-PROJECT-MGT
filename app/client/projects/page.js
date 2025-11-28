'use client';

import { useState, useEffect } from 'react';
import { Row, Col, Card, Badge, Form, InputGroup, Alert, Button } from 'react-bootstrap';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { databases, Query, COLLECTIONS, DB_ID } from '@/lib/appwriteClient';
import { formatDate } from '@/lib/date';
import AppLayout from '@/components/AppLayout';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function ClientProjectsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [projects, setProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (user && user.profile?.clientOrganizationIds) {
      loadProjects();
    }
  }, [user]);

  useEffect(() => {
    applyFilters();
  }, [projects, searchTerm, statusFilter]);

  const loadProjects = async () => {
    try {
      setLoading(true);

      // Get client organization IDs
      const clientOrgIds = user.profile.clientOrganizationIds || [];

      if (clientOrgIds.length === 0) {
        setError('No client organizations associated with your account');
        setLoading(false);
        return;
      }

      // Load all projects belonging to this client
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
      setFilteredProjects(projectsResponse.documents);
    } catch (err) {
      console.error('Failed to load projects:', err);
      setError('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...projects];

    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (project) =>
          project.name.toLowerCase().includes(search) ||
          project.code.toLowerCase().includes(search) ||
          (project.description && project.description.toLowerCase().includes(search))
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((project) => project.status === statusFilter);
    }

    setFilteredProjects(filtered);
  };

  const getStatusVariant = (status) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'completed':
        return 'info';
      case 'on_hold':
        return 'warning';
      case 'cancelled':
        return 'danger';
      default:
        return 'secondary';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active':
        return 'play-circle';
      case 'completed':
        return 'check-circle';
      case 'on_hold':
        return 'pause-circle';
      case 'cancelled':
        return 'x-circle';
      default:
        return 'circle';
    }
  };

  if (authLoading || loading) {
    return (
      <AppLayout user={user}>
        <LoadingSpinner message="Loading your projects..." />
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

  return (
    <AppLayout user={user}>
      {/* Header */}
      <div className="mb-4">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h2>Your Projects</h2>
            <p className="text-muted mb-0">View and track all your projects</p>
          </div>
          <Button variant="outline-secondary" onClick={() => router.push('/client/dashboard')}>
            <i className="bi bi-arrow-left me-2"></i>
            Back to Dashboard
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm mb-4">
        <Card.Body>
          <Row>
            <Col md={8}>
              <Form.Group>
                <InputGroup>
                  <InputGroup.Text>
                    <i className="bi bi-search"></i>
                  </InputGroup.Text>
                  <Form.Control
                    type="text"
                    placeholder="Search by project name, code, or description..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </InputGroup>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="on_hold">On Hold</option>
                  <option value="cancelled">Cancelled</option>
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Projects Count */}
      <div className="mb-3">
        <small className="text-muted">
          Showing {filteredProjects.length} of {projects.length} project{projects.length !== 1 ? 's' : ''}
        </small>
      </div>

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <Card.Body className="text-center py-5">
            <div className="mb-3">
              <i className="bi bi-inbox" style={{ fontSize: '3rem', opacity: 0.3 }}></i>
            </div>
            <h5>No Projects Found</h5>
            <p className="text-muted mb-0">
              {searchTerm || statusFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'No projects are currently associated with your account'}
            </p>
          </Card.Body>
        </Card>
      ) : (
        <Row>
          {filteredProjects.map((project) => (
            <Col key={project.$id} md={6} lg={4} className="mb-4">
              <Card
                className="border-0 shadow-sm h-100"
                style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-4px)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                onClick={() => router.push(`/client/projects/${project.$id}`)}
              >
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-start mb-3">
                    <div>
                      <div className="text-muted small mb-1">
                        <i className="bi bi-folder me-1"></i>
                        {project.code}
                      </div>
                      <h5 className="mb-0">{project.name}</h5>
                    </div>
                    <Badge bg={getStatusVariant(project.status)} className="text-uppercase" style={{ fontSize: '0.7rem' }}>
                      <i className={`bi bi-${getStatusIcon(project.status)} me-1`}></i>
                      {project.status.replace('_', ' ')}
                    </Badge>
                  </div>

                  {project.description && (
                    <p className="text-muted small mb-3" style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {project.description}
                    </p>
                  )}

                  <div className="border-top pt-3 mt-auto">
                    <Row className="g-2">
                      <Col xs={6}>
                        <div className="text-muted small">
                          <i className="bi bi-calendar-event me-1"></i>
                          Start
                        </div>
                        <div className="small">
                          {project.startDate ? formatDate(project.startDate) : 'Not set'}
                        </div>
                      </Col>
                      <Col xs={6}>
                        <div className="text-muted small">
                          <i className="bi bi-calendar-check me-1"></i>
                          End
                        </div>
                        <div className="small">
                          {project.endDate ? formatDate(project.endDate) : 'Not set'}
                        </div>
                      </Col>
                    </Row>
                  </div>
                </Card.Body>
                <Card.Footer className="bg-light border-0">
                  <div className="d-flex justify-content-between align-items-center">
                    <small className="text-muted">
                      <i className="bi bi-clock me-1"></i>
                      Created {formatDate(project.$createdAt)}
                    </small>
                    <i className="bi bi-arrow-right text-primary"></i>
                  </div>
                </Card.Footer>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </AppLayout>
  );
}
