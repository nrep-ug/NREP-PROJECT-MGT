'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Row, Col, Card, Table, Badge, Button, Form, InputGroup, ButtonGroup } from 'react-bootstrap';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useProjects } from '@/hooks/useProjects';
import { useClients } from '@/hooks/useClients';
import { formatDate } from '@/lib/date';
import AppLayout from '@/components/AppLayout';
import LoadingSpinner from '@/components/LoadingSpinner';
import Toast, { useToast } from '@/components/Toast';

export default function ProjectsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { data: projects = [], isLoading: projectsLoading, error: projectsError } = useProjects(user?.organizationId);
  const { data: clients = [] } = useClients(user?.organizationId);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState('grid'); // 'table' or 'grid'
  const { toast, showToast, hideToast } = useToast();

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

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return '#198754';
      case 'completed': return '#0dcaf0';
      case 'on_hold': return '#ffc107';
      case 'cancelled': return '#dc3545';
      case 'planned': return '#6c757d';
      default: return '#6c757d';
    }
  };

  const getCurrencySymbol = (currency) => {
    switch (currency) {
      case 'USD': return '$';
      case 'GBP': return '£';
      case 'EUR': return '€';
      case 'UGX': return 'Sh';
      default: return '$';
    }
  };

  // Filter and search projects
  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate statistics
  const stats = {
    total: projects.length,
    active: projects.filter(p => p.status === 'active').length,
    completed: projects.filter(p => p.status === 'completed').length,
    planned: projects.filter(p => p.status === 'planned').length,
    onHold: projects.filter(p => p.status === 'on_hold').length,
    totalBudget: projects.reduce((sum, p) => sum + (p.budgetAmount || 0), 0)
  };

  if (authLoading || projectsLoading) {
    return (
      <AppLayout user={user}>
        <LoadingSpinner message="Loading projects..." />
      </AppLayout>
    );
  }

  if (projectsError) {
    return (
      <AppLayout user={user}>
        <div className="alert alert-danger">
          Failed to load projects: {projectsError.message}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout user={user}>
      <Toast toast={toast} onClose={hideToast} />

      {/* Page Header */}
      <div className="mb-4">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h2 className="mb-1 fw-bold" style={{ color: '#1e293b' }}>Projects</h2>
            <p className="text-muted mb-0">Manage and track all your organization&apos;s projects</p>
          </div>
          {user?.isAdmin && (
            <Button
              onClick={() => router.push('/projects/new')}
              style={{
                backgroundColor: '#054653',
                border: 'none',
                padding: '0.75rem 1.5rem',
                fontSize: '0.95rem',
                fontWeight: '600',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#1d4ed8';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(37, 99, 235, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#054653';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(37, 99, 235, 0.2)';
              }}
            >
              <i className="bi bi-plus-circle me-2"></i>
              New Project
            </Button>
          )}
        </div>
      </div>

      {/* Statistics Cards */}
      <Row className="mb-4 g-3">
        <Col lg={3} md={6}>
          <Card className="border-0 shadow-sm h-100" style={{ borderRadius: '12px' }}>
            <Card.Body className="p-4">
              <div className="d-flex align-items-start justify-content-between mb-3">
                <div
                  className="rounded-3 d-inline-flex align-items-center justify-content-center"
                  style={{
                    width: '48px',
                    height: '48px',
                    backgroundColor: '#eff6ff'
                  }}
                >
                  <i className="bi bi-folder-fill" style={{ fontSize: '1.5rem', color: '#054653' }}></i>
                </div>
              </div>
              <h3 className="mb-1 fw-bold" style={{ fontSize: '2rem', color: '#1e293b' }}>{stats.total}</h3>
              <div className="text-muted small fw-medium">Total Projects</div>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={3} md={6}>
          <Card className="border-0 shadow-sm h-100" style={{ borderRadius: '12px' }}>
            <Card.Body className="p-4">
              <div className="d-flex align-items-start justify-content-between mb-3">
                <div
                  className="rounded-3 d-inline-flex align-items-center justify-content-center"
                  style={{
                    width: '48px',
                    height: '48px',
                    backgroundColor: '#f0fdf4'
                  }}
                >
                  <i className="bi bi-play-circle-fill" style={{ fontSize: '1.5rem', color: '#198754' }}></i>
                </div>
              </div>
              <h3 className="mb-1 fw-bold" style={{ fontSize: '2rem', color: '#1e293b' }}>{stats.active}</h3>
              <div className="text-muted small fw-medium">Active</div>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={3} md={6}>
          <Card className="border-0 shadow-sm h-100" style={{ borderRadius: '12px' }}>
            <Card.Body className="p-4">
              <div className="d-flex align-items-start justify-content-between mb-3">
                <div
                  className="rounded-3 d-inline-flex align-items-center justify-content-center"
                  style={{
                    width: '48px',
                    height: '48px',
                    backgroundColor: '#f8fafc'
                  }}
                >
                  <i className="bi bi-hourglass-split" style={{ fontSize: '1.5rem', color: '#64748b' }}></i>
                </div>
              </div>
              <h3 className="mb-1 fw-bold" style={{ fontSize: '2rem', color: '#1e293b' }}>{stats.planned}</h3>
              <div className="text-muted small fw-medium">Planned</div>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={3} md={6}>
          <Card className="border-0 shadow-sm h-100" style={{ borderRadius: '12px' }}>
            <Card.Body className="p-4">
              <div className="d-flex align-items-start justify-content-between mb-3">
                <div
                  className="rounded-3 d-inline-flex align-items-center justify-content-center"
                  style={{
                    width: '48px',
                    height: '48px',
                    backgroundColor: '#ecfeff'
                  }}
                >
                  <i className="bi bi-check-circle-fill" style={{ fontSize: '1.5rem', color: '#0dcaf0' }}></i>
                </div>
              </div>
              <h3 className="mb-1 fw-bold" style={{ fontSize: '2rem', color: '#1e293b' }}>{stats.completed}</h3>
              <div className="text-muted small fw-medium">Completed</div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Search and Filters */}
      <Card className="border-0 shadow-sm mb-4" style={{ borderRadius: '12px' }}>
        <Card.Body className="p-4">
          <Row className="g-3 align-items-center">
            <Col md={5}>
              <InputGroup>
                <InputGroup.Text
                  className="bg-white border-end-0"
                  style={{
                    borderRadius: '8px 0 0 8px',
                    borderColor: '#e2e8f0',
                    color: '#64748b'
                  }}
                >
                  <i className="bi bi-search"></i>
                </InputGroup.Text>
                <Form.Control
                  type="text"
                  placeholder="Search projects by name or code..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="border-start-0"
                  style={{
                    borderRadius: '0 8px 8px 0',
                    borderColor: '#e2e8f0',
                    boxShadow: 'none'
                  }}
                />
              </InputGroup>
            </Col>
            <Col md={5}>
              <div className="d-flex gap-2 flex-wrap">
                {['all', 'active', 'planned', 'on_hold', 'completed'].map((status) => {
                  const isActive = statusFilter === status;
                  return (
                    <Button
                      key={status}
                      variant=""
                      size="sm"
                      onClick={() => setStatusFilter(status)}
                      style={{
                        backgroundColor: 'white',
                        color: isActive ? '#14B8A6' : '#64748b',
                        border: isActive ? '2px solid #14B8A6' : '2px solid #cbd5e1',
                        borderRadius: '8px',
                        padding: '0.5rem 1rem',
                        fontSize: '0.875rem',
                        fontWeight: isActive ? '600' : '500',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.borderColor = '#054653';
                          e.currentTarget.style.color = '#054653';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.borderColor = '#cbd5e1';
                          e.currentTarget.style.color = '#64748b';
                        }
                      }}
                    >
                      {status === 'all' ? 'All' : status === 'on_hold' ? 'On Hold' : status.charAt(0).toUpperCase() + status.slice(1)}
                    </Button>
                  );
                })}
              </div>
            </Col>
            <Col md={2} className="text-end">
              <ButtonGroup>
                <Button
                  variant=""
                  onClick={() => setViewMode('grid')}
                  style={{
                    backgroundColor: 'white',
                    color: viewMode === 'grid' ? '#14B8A6' : '#64748b',
                    border: viewMode === 'grid' ? '2px solid #14B8A6' : '2px solid #cbd5e1',
                    borderRadius: '8px 0 0 8px',
                    padding: '0.5rem 1rem',
                    fontWeight: viewMode === 'grid' ? '600' : '500',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (viewMode !== 'grid') {
                      e.currentTarget.style.borderColor = '#054653';
                      e.currentTarget.style.color = '#054653';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (viewMode !== 'grid') {
                      e.currentTarget.style.borderColor = '#cbd5e1';
                      e.currentTarget.style.color = '#64748b';
                    }
                  }}
                >
                  <i className="bi bi-grid-3x3-gap"></i>
                </Button>
                <Button
                  variant=""
                  onClick={() => setViewMode('table')}
                  style={{
                    backgroundColor: 'white',
                    color: viewMode === 'table' ? '#14B8A6' : '#64748b',
                    border: viewMode === 'table' ? '2px solid #14B8A6' : '2px solid #cbd5e1',
                    borderRadius: '0 8px 8px 0',
                    padding: '0.5rem 1rem',
                    fontWeight: viewMode === 'table' ? '600' : '500',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (viewMode !== 'table') {
                      e.currentTarget.style.borderColor = '#054653';
                      e.currentTarget.style.color = '#054653';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (viewMode !== 'table') {
                      e.currentTarget.style.borderColor = '#cbd5e1';
                      e.currentTarget.style.color = '#64748b';
                    }
                  }}
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
            {projects.length === 0 ? (
              <>
                <div
                  className="rounded-circle d-inline-flex align-items-center justify-content-center mb-4"
                  style={{
                    width: '80px',
                    height: '80px',
                    backgroundColor: '#f8fafc'
                  }}
                >
                  <i className="bi bi-folder-x" style={{ fontSize: '2.5rem', color: '#cbd5e1' }}></i>
                </div>
                <h5 className="fw-bold mb-2" style={{ color: '#1e293b' }}>No Projects Yet</h5>
                <p className="text-muted mb-4">
                  {user?.isAdmin
                    ? 'Get started by creating your first project'
                    : 'No projects have been created yet'}
                </p>
                {user?.isAdmin && (
                  <Button
                    onClick={() => router.push('/projects/new')}
                    style={{
                      backgroundColor: '#054653',
                      border: 'none',
                      padding: '0.75rem 1.5rem',
                      fontSize: '0.95rem',
                      fontWeight: '600',
                      borderRadius: '8px'
                    }}
                  >
                    <i className="bi bi-plus-circle me-2"></i>
                    Create Your First Project
                  </Button>
                )}
              </>
            ) : (
              <>
                <div
                  className="rounded-circle d-inline-flex align-items-center justify-content-center mb-4"
                  style={{
                    width: '80px',
                    height: '80px',
                    backgroundColor: '#f8fafc'
                  }}
                >
                  <i className="bi bi-search" style={{ fontSize: '2.5rem', color: '#cbd5e1' }}></i>
                </div>
                <h5 className="fw-bold mb-2" style={{ color: '#1e293b' }}>No Projects Found</h5>
                <p className="text-muted">Try adjusting your search or filter criteria</p>
              </>
            )}
          </Card.Body>
        </Card>
      ) : viewMode === 'grid' ? (
        <Row className="g-4">
          {filteredProjects.map((project) => {
            const client = clients.find(c => c.$id === project.clientId);
            return (
              <Col key={project.$id} md={6} lg={4}>
                <Card
                  className="border-0 shadow-sm h-100"
                  style={{
                    borderRadius: '12px',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '';
                  }}
                  onClick={() => router.push(`/projects/${project.$id}`)}
                >
                  <Card.Body className="p-4">
                    <div className="d-flex justify-content-between align-items-start mb-3">
                      <Badge
                        style={{
                          backgroundColor: '#054653',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          padding: '0.4rem 0.75rem',
                          borderRadius: '6px'
                        }}
                      >
                        {project.code}
                      </Badge>
                      <Badge
                        bg={getStatusVariant(project.status)}
                        className="text-capitalize"
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          padding: '0.4rem 0.75rem',
                          borderRadius: '6px'
                        }}
                      >
                        {project.status.replace('_', ' ')}
                      </Badge>
                    </div>

                    <h5 className="fw-bold mb-2" style={{ color: '#1e293b' }}>
                      {project.name}
                    </h5>

                    {project.description && (
                      <p
                        className="text-muted mb-3 small"
                        style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          lineHeight: '1.5'
                        }}
                      >
                        {project.description}
                      </p>
                    )}

                    {client && (
                      <div
                        className="d-flex align-items-center mb-3 p-2 rounded"
                        style={{ backgroundColor: '#f8fafc' }}
                      >
                        <div
                          className="rounded-circle d-flex align-items-center justify-content-center me-2"
                          style={{
                            width: '32px',
                            height: '32px',
                            backgroundColor: '#14B8A6'
                          }}
                        >
                          <i className="bi bi-building text-white" style={{ fontSize: '0.875rem' }}></i>
                        </div>
                        <div className="flex-grow-1">
                          <div className="small text-muted">Client</div>
                          <div className="fw-semibold small" style={{ color: '#1e293b' }}>{client.name}</div>
                        </div>
                      </div>
                    )}

                    {(project.startDate || project.endDate) && (
                      <div className="d-flex align-items-center mb-3 text-muted small">
                        <i className="bi bi-calendar-event me-2"></i>
                        {project.startDate && formatDate(project.startDate)}
                        {project.startDate && project.endDate && ' - '}
                        {project.endDate && formatDate(project.endDate)}
                      </div>
                    )}

                    <div className="d-flex justify-content-between align-items-center pt-3 border-top">
                      <span className="text-muted small">Budget</span>
                      <span className="fw-bold" style={{ color: '#054653', fontSize: '1.1rem' }}>
                        {getCurrencySymbol(project.budgetCurrency || 'USD')}{project.budgetAmount?.toLocaleString() || '0'}
                      </span>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            );
          })}
        </Row>
      ) : (
        <Card className="border-0 shadow-sm" style={{ borderRadius: '12px' }}>
          <div className="table-responsive">
            <Table hover className="mb-0">
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
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
                  const client = clients.find(c => c.$id === project.clientId);
                  return (
                    <tr
                      key={project.$id}
                      style={{
                        cursor: 'pointer',
                        transition: 'background-color 0.2s ease'
                      }}
                      onClick={() => router.push(`/projects/${project.$id}`)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f8fafc';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <td className="py-3 px-4">
                        <Badge
                          style={{
                            backgroundColor: '#054653',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            padding: '0.4rem 0.75rem',
                            borderRadius: '6px'
                          }}
                        >
                          {project.code}
                        </Badge>
                      </td>
                      <td className="py-3">
                        <div className="fw-semibold" style={{ color: '#1e293b' }}>{project.name}</div>
                        {project.description && (
                          <div className="small text-muted text-truncate" style={{ maxWidth: '300px' }}>
                            {project.description}
                          </div>
                        )}
                      </td>
                      <td className="py-3">
                        {client ? (
                          <div className="d-flex align-items-center">
                            <div
                              className="rounded-circle d-flex align-items-center justify-content-center me-2"
                              style={{
                                width: '28px',
                                height: '28px',
                                backgroundColor: '#14B8A6'
                              }}
                            >
                              <i className="bi bi-building text-white" style={{ fontSize: '0.7rem' }}></i>
                            </div>
                            <span className="small">{client.name}</span>
                          </div>
                        ) : (
                          <span className="text-muted small">-</span>
                        )}
                      </td>
                      <td className="py-3">
                        <Badge
                          bg={getStatusVariant(project.status)}
                          className="text-capitalize"
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            padding: '0.4rem 0.75rem',
                            borderRadius: '6px'
                          }}
                        >
                          {project.status.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="py-3">
                        {project.startDate && project.endDate ? (
                          <div className="d-flex align-items-center text-muted small">
                            <i className="bi bi-calendar-event me-2"></i>
                            {formatDate(project.startDate)} - {formatDate(project.endDate)}
                          </div>
                        ) : project.startDate ? (
                          <div className="d-flex align-items-center text-muted small">
                            <i className="bi bi-calendar-event me-2"></i>
                            {formatDate(project.startDate)}
                          </div>
                        ) : (
                          <span className="text-muted small">Not set</span>
                        )}
                      </td>
                      <td className="py-3 text-end px-4">
                        <span className="fw-bold" style={{ color: '#054653' }}>
                          {getCurrencySymbol(project.budgetCurrency || 'USD')}{project.budgetAmount?.toLocaleString() || '0'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        </Card>
      )}
    </AppLayout>
  );
}
