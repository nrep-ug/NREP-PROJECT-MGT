'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Badge, Form, InputGroup, Card as BootstrapCard, Row, Col, ProgressBar } from 'react-bootstrap';
import { useProjectMilestones, useProjectTasks } from '@/hooks/useProjects';
import { formatDate } from '@/lib/date';

export default function ProjectMilestones({ project, user, showToast, canModify }) {
  const router = useRouter();
  const { data: milestones = [], isLoading: milestonesLoading } = useProjectMilestones(project?.$id);
  const { data: tasks = [] } = useProjectTasks(project?.$id);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const getStatusColor = (status) => {
    const colors = {
      open: 'primary',
      reached: 'success',
      closed: 'secondary'
    };
    return colors[status] || 'secondary';
  };

  const getStatusIcon = (status) => {
    const icons = {
      open: 'bi-flag',
      reached: 'bi-flag-fill',
      closed: 'bi-archive'
    };
    return icons[status] || 'bi-flag';
  };

  // Calculate milestone progress
  const getMilestoneProgress = (milestoneId) => {
    const milestoneTasks = tasks.filter(t => t.milestoneId === milestoneId);
    if (milestoneTasks.length === 0) return 0;
    const completedTasks = milestoneTasks.filter(t => t.status === 'done').length;
    return Math.round((completedTasks / milestoneTasks.length) * 100);
  };

  const getMilestoneTaskCount = (milestoneId) => {
    return tasks.filter(t => t.milestoneId === milestoneId).length;
  };

  // Filter milestones
  const filteredMilestones = milestones.filter(milestone => {
    const matchesSearch = milestone.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (milestone.description && milestone.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || milestone.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate statistics
  const stats = {
    total: milestones.length,
    open: milestones.filter(m => m.status === 'open').length,
    reached: milestones.filter(m => m.status === 'reached').length,
    closed: milestones.filter(m => m.status === 'closed').length,
  };

  const MilestoneCard = ({ milestone }) => {
    const progress = getMilestoneProgress(milestone.$id);
    const taskCount = getMilestoneTaskCount(milestone.$id);
    const isOverdue = milestone.dueDate && new Date(milestone.dueDate) < new Date() && milestone.status !== 'reached' && milestone.status !== 'closed';

    return (
      <BootstrapCard
        className="milestone-card border-0 shadow-sm mb-3"
        style={{ cursor: 'pointer' }}
        onClick={() => router.push(`/projects/${project.$id}/milestones/${milestone.$id}`)}
      >
        <BootstrapCard.Body>
          <div className="d-flex justify-content-between align-items-start mb-3">
            <div className="flex-grow-1">
              <div className="d-flex align-items-center gap-2 mb-2">
                <i className={`${getStatusIcon(milestone.status)} text-${getStatusColor(milestone.status)}`} style={{ fontSize: '1.2rem' }}></i>
                <h5 className="mb-0">{milestone.name}</h5>
              </div>
              {milestone.description && (
                <p className="text-muted small mb-2" style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical'
                }}>
                  {milestone.description}
                </p>
              )}
            </div>
            <Badge bg={getStatusColor(milestone.status)} className="ms-2">
              {milestone.status}
            </Badge>
          </div>

          {/* Progress Bar */}
          {taskCount > 0 && (
            <div className="mb-3">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <small className="text-muted">Task Progress</small>
                <small className="text-muted fw-bold">{progress}%</small>
              </div>
              <ProgressBar
                now={progress}
                variant={progress === 100 ? 'success' : progress > 50 ? 'primary' : 'warning'}
                style={{ height: '6px' }}
              />
            </div>
          )}

          {/* Dates and Info */}
          <Row className="g-2">
            <Col xs={6} md={4}>
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-calendar-event text-muted"></i>
                <div>
                  <small className="text-muted d-block" style={{ fontSize: '0.7rem' }}>START</small>
                  <small className="fw-bold">
                    {milestone.startDate ? formatDate(milestone.startDate) : '-'}
                  </small>
                </div>
              </div>
            </Col>
            <Col xs={6} md={4}>
              <div className="d-flex align-items-center gap-2">
                <i className={`bi bi-calendar-check ${isOverdue ? 'text-danger' : 'text-muted'}`}></i>
                <div>
                  <small className="text-muted d-block" style={{ fontSize: '0.7rem' }}>DUE</small>
                  <small className={`fw-bold ${isOverdue ? 'text-danger' : ''}`}>
                    {milestone.dueDate ? formatDate(milestone.dueDate) : '-'}
                  </small>
                </div>
              </div>
            </Col>
            <Col xs={12} md={4}>
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-list-task text-muted"></i>
                <div>
                  <small className="text-muted d-block" style={{ fontSize: '0.7rem' }}>TASKS</small>
                  <small className="fw-bold">{taskCount}</small>
                </div>
              </div>
            </Col>
          </Row>

          {/* Overdue Warning */}
          {isOverdue && (
            <div className="mt-2">
              <Badge bg="danger" className="w-100 py-2">
                <i className="bi bi-exclamation-triangle me-1"></i>
                Overdue
              </Badge>
            </div>
          )}
        </BootstrapCard.Body>
      </BootstrapCard>
    );
  };

  if (milestonesLoading) {
    return <div className="text-center py-5"><div className="spinner-border text-primary" role="status"></div></div>;
  }

  return (
    <div>
      {/* Header with Actions */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-4">
        <div className="d-flex align-items-center gap-2">
          <h5 className="mb-0">Milestones</h5>
          <Badge bg="secondary">{filteredMilestones.length}</Badge>
        </div>

        <div className="d-flex flex-column flex-md-row gap-2 w-100 w-md-auto">
          {/* Search */}
          <InputGroup style={{ maxWidth: '300px' }}>
            <InputGroup.Text>
              <i className="bi bi-search"></i>
            </InputGroup.Text>
            <Form.Control
              type="text"
              placeholder="Search milestones..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </InputGroup>

          {/* Status Filter */}
          <Form.Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ maxWidth: '150px' }}
          >
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="reached">Reached</option>
            <option value="closed">Closed</option>
          </Form.Select>

          {/* Add Milestone Button */}
          {canModify && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => router.push(`/projects/${project.$id}/milestones/new`)}
            >
              <i className="bi bi-plus-circle me-1"></i>
              <span className="d-none d-sm-inline">New Milestone</span>
            </Button>
          )}
        </div>
      </div>

      {/* Statistics Cards */}
      <Row className="mb-4">
        <Col xs={6} md={3} className="mb-2">
          <BootstrapCard className="border-0 shadow-sm h-100">
            <BootstrapCard.Body className="p-3">
              <div className="d-flex align-items-center">
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    backgroundColor: '#f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '0.5rem',
                    flexShrink: 0
                  }}
                >
                  <i className="bi bi-flag" style={{ fontSize: '1.5rem', color: '#64748b' }}></i>
                </div>
                <div>
                  <div className="small text-muted" style={{ fontSize: '0.75rem', fontWeight: '500' }}>Total</div>
                  <h4 className="mb-0" style={{ fontSize: '1.75rem', fontWeight: '700', color: '#1e293b' }}>{stats.total}</h4>
                </div>
              </div>
            </BootstrapCard.Body>
          </BootstrapCard>
        </Col>
        <Col xs={6} md={3} className="mb-2">
          <BootstrapCard className="border-0 shadow-sm h-100">
            <BootstrapCard.Body className="p-3">
              <div className="d-flex align-items-center">
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    backgroundColor: '#ecfdf5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '0.5rem',
                    flexShrink: 0
                  }}
                >
                  <i className="bi bi-flag" style={{ fontSize: '1.5rem', color: '#054653' }}></i>
                </div>
                <div>
                  <div className="small text-muted" style={{ fontSize: '0.75rem', fontWeight: '500' }}>Open</div>
                  <h4 className="mb-0" style={{ fontSize: '1.75rem', fontWeight: '700', color: '#1e293b' }}>{stats.open}</h4>
                </div>
              </div>
            </BootstrapCard.Body>
          </BootstrapCard>
        </Col>
        <Col xs={6} md={3} className="mb-2">
          <BootstrapCard className="border-0 shadow-sm h-100">
            <BootstrapCard.Body className="p-3">
              <div className="d-flex align-items-center">
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    backgroundColor: '#dcfce7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '0.5rem',
                    flexShrink: 0
                  }}
                >
                  <i className="bi bi-flag-fill" style={{ fontSize: '1.5rem', color: '#16a34a' }}></i>
                </div>
                <div>
                  <div className="small text-muted" style={{ fontSize: '0.75rem', fontWeight: '500' }}>Reached</div>
                  <h4 className="mb-0" style={{ fontSize: '1.75rem', fontWeight: '700', color: '#1e293b' }}>{stats.reached}</h4>
                </div>
              </div>
            </BootstrapCard.Body>
          </BootstrapCard>
        </Col>
        <Col xs={6} md={3} className="mb-2">
          <BootstrapCard className="border-0 shadow-sm h-100">
            <BootstrapCard.Body className="p-3">
              <div className="d-flex align-items-center">
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    backgroundColor: '#f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '0.5rem',
                    flexShrink: 0
                  }}
                >
                  <i className="bi bi-archive" style={{ fontSize: '1.5rem', color: '#64748b' }}></i>
                </div>
                <div>
                  <div className="small text-muted" style={{ fontSize: '0.75rem', fontWeight: '500' }}>Closed</div>
                  <h4 className="mb-0" style={{ fontSize: '1.75rem', fontWeight: '700', color: '#1e293b' }}>{stats.closed}</h4>
                </div>
              </div>
            </BootstrapCard.Body>
          </BootstrapCard>
        </Col>
      </Row>

      {/* Milestones List */}
      {filteredMilestones.length === 0 ? (
        <div className="text-center py-5">
          <div className="mb-3">
            <i className="bi bi-flag" style={{ fontSize: '4rem', opacity: 0.3 }}></i>
          </div>
          <h5>{searchTerm || statusFilter !== 'all' ? 'No milestones found' : 'No Milestones Yet'}</h5>
          <p className="text-muted mb-3">
            {searchTerm || statusFilter !== 'all'
              ? 'Try adjusting your search or filter criteria'
              : 'Create your first milestone to track project progress'}
          </p>
          {!searchTerm && statusFilter === 'all' && canModify && (
            <Button
              variant="primary"
              onClick={() => router.push(`/projects/${project.$id}/milestones/new`)}
            >
              <i className="bi bi-plus-circle me-2"></i>
              Create Milestone
            </Button>
          )}
        </div>
      ) : (
        <div className="milestones-grid">
          {filteredMilestones.map(milestone => (
            <MilestoneCard key={milestone.$id} milestone={milestone} />
          ))}
        </div>
      )}

      <style jsx global>{`
        .milestone-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15) !important;
          transition: all 0.2s;
        }

        @media (min-width: 768px) {
          .milestones-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
            gap: 1rem;
          }
        }
      `}</style>
    </div>
  );
}
