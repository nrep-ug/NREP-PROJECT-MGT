'use client';

import { Row, Col, Card, Badge, Button } from 'react-bootstrap';
import { formatDate } from '@/lib/date';

export default function ProjectOverview({ project, user, showToast, onUpdate }) {
  const getStatusVariant = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'completed': return 'info';
      case 'on_hold': return 'warning';
      case 'cancelled': return 'danger';
      default: return 'secondary';
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

  return (
    <div>
      <Row className="g-4">
        {/* Project Information */}
        <Col lg={8}>
          {/* Project Details Card */}
          <Card className="border-0 shadow-sm mb-4" style={{ borderRadius: '12px' }}>
            <Card.Body className="p-4">
              <div className="d-flex align-items-center gap-2 mb-4">
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center"
                  style={{
                    width: '36px',
                    height: '36px',
                    backgroundColor: '#ecfdf5'
                  }}
                >
                  <i className="bi bi-info-circle-fill" style={{ color: '#054653', fontSize: '1rem' }}></i>
                </div>
                <h5 className="mb-0 fw-bold" style={{ color: '#1e293b' }}>Project Information</h5>
              </div>

              <Row className="g-4">
                <Col md={6}>
                  <div className="mb-3">
                    <small className="text-muted text-uppercase d-block mb-2" style={{ fontSize: '0.7rem', fontWeight: '600', letterSpacing: '0.5px' }}>
                      Project Code
                    </small>
                    <Badge
                      style={{
                        backgroundColor: '#054653',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        padding: '0.5rem 1rem',
                        borderRadius: '8px',
                        color: 'white'
                      }}
                    >
                      {project.code}
                    </Badge>
                  </div>
                </Col>

                <Col md={6}>
                  <div className="mb-3">
                    <small className="text-muted text-uppercase d-block mb-2" style={{ fontSize: '0.7rem', fontWeight: '600', letterSpacing: '0.5px' }}>
                      Status
                    </small>
                    <Badge
                      bg={getStatusVariant(project.status)}
                      className="text-capitalize"
                      style={{
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        padding: '0.5rem 1rem',
                        borderRadius: '8px'
                      }}
                    >
                      {project.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </Col>

                <Col md={6}>
                  <div className="mb-3">
                    <small className="text-muted text-uppercase d-block mb-2" style={{ fontSize: '0.7rem', fontWeight: '600', letterSpacing: '0.5px' }}>
                      Start Date
                    </small>
                    <div className="d-flex align-items-center gap-2">
                      <i className="bi bi-calendar-event" style={{ color: '#14B8A6', fontSize: '1.25rem' }}></i>
                      <span className="fw-semibold" style={{ color: '#1e293b' }}>
                        {project.startDate ? formatDate(project.startDate) : <span className="text-muted fst-italic">Not set</span>}
                      </span>
                    </div>
                  </div>
                </Col>

                <Col md={6}>
                  <div className="mb-3">
                    <small className="text-muted text-uppercase d-block mb-2" style={{ fontSize: '0.7rem', fontWeight: '600', letterSpacing: '0.5px' }}>
                      End Date
                    </small>
                    <div className="d-flex align-items-center gap-2">
                      <i className="bi bi-calendar-check" style={{ color: '#14B8A6', fontSize: '1.25rem' }}></i>
                      <span className="fw-semibold" style={{ color: '#1e293b' }}>
                        {project.endDate ? formatDate(project.endDate) : <span className="text-muted fst-italic">Not set</span>}
                      </span>
                    </div>
                  </div>
                </Col>

                <Col md={12}>
                  <div className="mb-3">
                    <small className="text-muted text-uppercase d-block mb-2" style={{ fontSize: '0.7rem', fontWeight: '600', letterSpacing: '0.5px' }}>
                      Budget
                    </small>
                    <div
                      className="d-flex align-items-center gap-2 p-3 rounded-3"
                      style={{ backgroundColor: '#f8fafc' }}
                    >
                      <i className="bi bi-cash-stack" style={{ color: '#054653', fontSize: '1.5rem' }}></i>
                      <div>
                        <div className="fw-bold" style={{ color: '#054653', fontSize: '1.75rem' }}>
                          {getCurrencySymbol(project.budgetCurrency || 'USD')}{project.budgetAmount?.toLocaleString() || '0'}
                        </div>
                        <small className="text-muted">
                          {project.budgetCurrency ? project.budgetCurrency : 'USD'}
                        </small>
                      </div>
                    </div>
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>

          {/* Description Card */}
          {project.description && (
            <Card className="border-0 shadow-sm" style={{ borderRadius: '12px' }}>
              <Card.Body className="p-4">
                <div className="d-flex align-items-center gap-2 mb-3">
                  <div
                    className="rounded-circle d-flex align-items-center justify-content-center"
                    style={{
                      width: '36px',
                      height: '36px',
                      backgroundColor: '#f0fdf4'
                    }}
                  >
                    <i className="bi bi-file-text-fill" style={{ color: '#14B8A6', fontSize: '1rem' }}></i>
                  </div>
                  <h5 className="mb-0 fw-bold" style={{ color: '#1e293b' }}>Description</h5>
                </div>
                <p className="mb-0" style={{ color: '#64748b', lineHeight: '1.75' }}>
                  {project.description}
                </p>
              </Card.Body>
            </Card>
          )}
        </Col>

        {/* Sidebar */}
        <Col lg={4}>
          {/* Project Duration Card */}
          {(project.startDate || project.endDate) && (
            <Card className="border-0 shadow-sm mb-4" style={{ borderRadius: '12px' }}>
              <Card.Body className="p-4">
                <div className="d-flex align-items-center gap-2 mb-3">
                  <div
                    className="rounded-circle d-flex align-items-center justify-content-center"
                    style={{
                      width: '36px',
                      height: '36px',
                      backgroundColor: '#fef3c7'
                    }}
                  >
                    <i className="bi bi-clock-fill" style={{ color: '#f59e0b', fontSize: '1rem' }}></i>
                  </div>
                  <h6 className="mb-0 fw-bold" style={{ color: '#1e293b' }}>Project Duration</h6>
                </div>

                <div className="p-3 rounded-3" style={{ backgroundColor: '#f8fafc' }}>
                  {project.startDate && (
                    <div className="mb-2">
                      <small className="text-muted d-block mb-1" style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.5px' }}>
                        Starts
                      </small>
                      <div className="fw-semibold" style={{ color: '#1e293b' }}>
                        {formatDate(project.startDate)}
                      </div>
                    </div>
                  )}

                  {project.startDate && project.endDate && (
                    <div className="text-center my-2">
                      <i className="bi bi-arrow-down" style={{ color: '#cbd5e1' }}></i>
                    </div>
                  )}

                  {project.endDate && (
                    <div>
                      <small className="text-muted d-block mb-1" style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.5px' }}>
                        Ends
                      </small>
                      <div className="fw-semibold" style={{ color: '#1e293b' }}>
                        {formatDate(project.endDate)}
                      </div>
                    </div>
                  )}

                  {!project.startDate && !project.endDate && (
                    <p className="text-muted mb-0 text-center fst-italic">
                      No timeline set
                    </p>
                  )}
                </div>
              </Card.Body>
            </Card>
          )}

          {/* Quick Actions Card */}
          <Card className="border-0 shadow-sm" style={{ borderRadius: '12px' }}>
            <Card.Body className="p-4">
              <div className="d-flex align-items-center gap-2 mb-3">
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center"
                  style={{
                    width: '36px',
                    height: '36px',
                    backgroundColor: '#fae8ff'
                  }}
                >
                  <i className="bi bi-lightning-fill" style={{ color: '#a855f7', fontSize: '1rem' }}></i>
                </div>
                <h6 className="mb-0 fw-bold" style={{ color: '#1e293b' }}>Quick Actions</h6>
              </div>

              <div className="d-grid gap-2">
                {user?.isAdmin && (
                  <>
                    <Button
                      variant=""
                      size="sm"
                      style={{
                        backgroundColor: 'white',
                        border: '2px solid #cbd5e1',
                        color: '#64748b',
                        padding: '0.75rem 1rem',
                        borderRadius: '8px',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        transition: 'all 0.2s ease',
                        textAlign: 'left'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#054653';
                        e.currentTarget.style.color = '#054653';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#cbd5e1';
                        e.currentTarget.style.color = '#64748b';
                      }}
                    >
                      <i className="bi bi-pencil-square me-2"></i>
                      Edit Project
                    </Button>

                    <Button
                      variant=""
                      size="sm"
                      style={{
                        backgroundColor: 'white',
                        border: '2px solid #cbd5e1',
                        color: '#64748b',
                        padding: '0.75rem 1rem',
                        borderRadius: '8px',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        transition: 'all 0.2s ease',
                        textAlign: 'left'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#14B8A6';
                        e.currentTarget.style.color = '#14B8A6';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#cbd5e1';
                        e.currentTarget.style.color = '#64748b';
                      }}
                    >
                      <i className="bi bi-gear me-2"></i>
                      Project Settings
                    </Button>
                  </>
                )}

                <Button
                  variant=""
                  size="sm"
                  style={{
                    backgroundColor: 'white',
                    border: '2px solid #cbd5e1',
                    color: '#64748b',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    transition: 'all 0.2s ease',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#f59e0b';
                    e.currentTarget.style.color = '#f59e0b';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#cbd5e1';
                    e.currentTarget.style.color = '#64748b';
                  }}
                >
                  <i className="bi bi-download me-2"></i>
                  Export Report
                </Button>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
