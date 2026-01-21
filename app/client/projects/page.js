'use client';

import { useState, useEffect } from 'react';
import { Row, Col, Card, Badge, Form, InputGroup, Button, Table, ButtonGroup } from 'react-bootstrap';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { databases, Query, COLLECTIONS, DB_ID } from '@/lib/appwriteClient';
import { formatDate } from '@/lib/date';
import AppLayout from '@/components/AppLayout';
import LoadingSpinner from '@/components/LoadingSpinner';
import Toast, { useToast } from '@/components/Toast';

export default function ClientProjectsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast, showToast, hideToast } = useToast();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // UI State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState('grid');

  // Data Loading
  useEffect(() => {
    if (user && user.profile?.clientOrganizationIds) {
      loadProjects();
    } else if (user && !user.profile?.clientOrganizationIds && !authLoading) {
      setLoading(false); // No orgs, just stop loading
    }
  }, [user, authLoading]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const clientOrgIds = user.profile.clientOrganizationIds || [];

      if (clientOrgIds.length === 0) {
        setProjects([]);
        setLoading(false);
        return;
      }

      // Load projects strictly for this client
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
    } catch (err) {
      console.error('Failed to load projects:', err);
      showToast('Failed to load projects', 'danger');
    } finally {
      setLoading(false);
    }
  };

  // derived state
  const filteredProjects = projects.filter(project => {
    const matchesSearch =
      project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (project.description && project.description.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: projects.length,
    active: projects.filter(p => p.status === 'active').length,
    completed: projects.filter(p => p.status === 'completed').length,
    planned: projects.filter(p => p.status === 'planned').length,
  };

  const getStatusVariant = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'completed': return 'info';
      case 'on_hold': return 'warning';
      case 'cancelled': return 'danger';
      case 'planned': return 'secondary';
      default: return 'secondary';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active': return 'play-circle';
      case 'completed': return 'check-circle';
      case 'on_hold': return 'pause-circle';
      case 'cancelled': return 'x-circle';
      default: return 'circle';
    }
  };


  if (authLoading || loading) {
    return (
      <AppLayout user={user}>
        <LoadingSpinner message="Loading your projects..." />
      </AppLayout>
    );
  }

  return (
    <AppLayout user={user}>
      <Toast toast={toast} onClose={hideToast} />

      {/* Hero Header */}
      <Card className="border-0 shadow-sm mb-4" style={{ background: 'linear-gradient(135deg, #054653 0%, #14B8A6 100%)' }}>
        <Card.Body className="text-white p-4">
          <Row className="align-items-center">
            <Col md={8}>
              <h2 className="mb-2">
                <i className="bi bi-folder-check me-3"></i>
                My Projects
              </h2>
              <p className="mb-0 opacity-90">
                Track status and progress of your active projects
              </p>
            </Col>
            {/* Client specific badge or info could go here */}
          </Row>
        </Card.Body>
      </Card>

      {/* Statistics Cards */}
      <Row className="mb-4 g-3">
        <Col lg={4} md={4}>
          <Card className="border-0 shadow-sm h-100" style={{ borderRadius: '12px' }}>
            <Card.Body className="p-4">
              <div className="d-flex align-items-center mb-2">
                <div className="rounded-circle bg-light d-flex align-items-center justify-content-center me-3" style={{ width: '48px', height: '48px' }}>
                  <i className="bi bi-folder text-primary fs-4"></i>
                </div>
                <div>
                  <h3 className="mb-0 fw-bold">{stats.total}</h3>
                  <div className="text-muted small">Total Projects</div>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={4} md={4}>
          <Card className="border-0 shadow-sm h-100" style={{ borderRadius: '12px' }}>
            <Card.Body className="p-4">
              <div className="d-flex align-items-center mb-2">
                <div className="rounded-circle bg-success-subtle d-flex align-items-center justify-content-center me-3" style={{ width: '48px', height: '48px' }}>
                  <i className="bi bi-play-circle text-success fs-4"></i>
                </div>
                <div>
                  <h3 className="mb-0 fw-bold">{stats.active}</h3>
                  <div className="text-muted small">Active</div>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={4} md={4}>
          <Card className="border-0 shadow-sm h-100" style={{ borderRadius: '12px' }}>
            <Card.Body className="p-4">
              <div className="d-flex align-items-center mb-2">
                <div className="rounded-circle bg-info-subtle d-flex align-items-center justify-content-center me-3" style={{ width: '48px', height: '48px' }}>
                  <i className="bi bi-check-circle text-info fs-4"></i>
                </div>
                <div>
                  <h3 className="mb-0 fw-bold">{stats.completed}</h3>
                  <div className="text-muted small">Completed</div>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Filters & Search */}
      <Card className="border-0 shadow-sm mb-4" style={{ borderRadius: '12px' }}>
        <Card.Body className="p-4">
          <Row className="g-3 align-items-center">
            <Col md={5}>
              <InputGroup>
                <InputGroup.Text className="bg-white border-end-0">
                  <i className="bi bi-search"></i>
                </InputGroup.Text>
                <Form.Control
                  type="text"
                  placeholder="Search projects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="border-start-0"
                />
              </InputGroup>
            </Col>
            <Col md={5}>
              <div className="d-flex gap-2 flex-wrap">
                {['all', 'active', 'completed'].map(status => (
                  <Button
                    key={status}
                    variant={statusFilter === status ? 'primary' : 'outline-secondary'}
                    size="sm"
                    onClick={() => setStatusFilter(status)}
                    className="text-capitalize rounded-pill px-3"
                  >
                    {status}
                  </Button>
                ))}
              </div>
            </Col>
            <Col md={2} className="text-end">
              <ButtonGroup>
                <Button
                  variant={viewMode === 'grid' ? 'primary' : 'outline-secondary'}
                  onClick={() => setViewMode('grid')}
                  size="sm"
                >
                  <i className="bi bi-grid-3x3-gap"></i>
                </Button>
                <Button
                  variant={viewMode === 'table' ? 'primary' : 'outline-secondary'}
                  onClick={() => setViewMode('table')}
                  size="sm"
                >
                  <i className="bi bi-table"></i>
                </Button>
              </ButtonGroup>
            </Col>
          </Row>
          <Row className="mt-3">
            <Col>
              <small className="text-muted">
                Showing <strong>{filteredProjects.length}</strong> of <strong>{projects.length}</strong> projects
              </small>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Projects Display */}
      {filteredProjects.length === 0 ? (
        <Card className="border-0 shadow-sm" style={{ borderRadius: '12px' }}>
          <Card.Body className="text-center py-5">
            <div className="mb-3 text-muted opacity-25">
              <i className="bi bi-folder-x" style={{ fontSize: '3rem' }}></i>
            </div>
            <h5>No Projects Found</h5>
            <p className="text-muted">
              {searchTerm ? 'Try adjusting your search filters' : 'You are not assigned to any projects at the moment.'}
            </p>
          </Card.Body>
        </Card>
      ) : viewMode === 'grid' ? (
        <Row className="g-4">
          {filteredProjects.map((project) => (
            <Col key={project.$id} md={6} lg={4}>
              <Card
                className="border-0 shadow-sm h-100 project-card"
                style={{ borderRadius: '12px', cursor: 'pointer', transition: 'transform 0.2s' }}
                onClick={() => router.push(`/client/projects/${project.$id}`)}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-5px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <Card.Body className="p-4 d-flex flex-column">
                  <div className="d-flex justify-content-between align-items-start mb-3">
                    <Badge bg="light" text="dark" className="border">
                      {project.code}
                    </Badge>
                    <Badge bg={getStatusVariant(project.status)} className="text-uppercase" style={{ fontSize: '0.7rem' }}>
                      <i className={`bi bi-${getStatusIcon(project.status)} me-1`}></i>
                      {project.status?.replace('_', ' ')}
                    </Badge>
                  </div>

                  <h5 className="fw-bold mb-2">{project.name}</h5>
                  {project.description && (
                    <p className="text-muted small mb-3 flex-grow-1" style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {project.description}
                    </p>
                  )}

                  <div className="border-top pt-3 mt-auto">
                    <div className="d-flex align-items-center text-muted small">
                      <i className="bi bi-calendar-event me-2"></i>
                      {project.startDate ? formatDate(project.startDate) : 'TBD'}
                      {project.endDate && ` - ${formatDate(project.endDate)}`}
                    </div>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      ) : (
        <Card className="border-0 shadow-sm" style={{ borderRadius: '12px' }}>
          <div className="table-responsive">
            <Table hover className="mb-0">
              <thead className="bg-light">
                <tr>
                  <th className="py-3 px-4 border-0">Code</th>
                  <th className="py-3 border-0">Project</th>
                  <th className="py-3 border-0">Status</th>
                  <th className="py-3 border-0">Timeline</th>
                  {/* No Budget Column */}
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((project) => (
                  <tr
                    key={project.$id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => router.push(`/client/projects/${project.$id}`)}
                  >
                    <td className="py-3 px-4">
                      <Badge bg="light" text="dark" className="border">{project.code}</Badge>
                    </td>
                    <td className="py-3">
                      <span className="fw-medium">{project.name}</span>
                    </td>
                    <td className="py-3">
                      <Badge bg={getStatusVariant(project.status)} className="text-uppercase" style={{ fontSize: '0.7rem' }}>
                        {project.status?.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="py-3 text-muted small">
                      {project.startDate ? formatDate(project.startDate) : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>
      )}
    </AppLayout>
  );
}
