'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Row, Col, Badge, Button, Table, Alert } from 'react-bootstrap';
import { useAuth } from '@/hooks/useAuth';
import { useTimesheetDashboard } from '@/hooks/useTimesheets';
import { formatDate, formatHours } from '@/lib/date';
import AppLayout from '@/components/AppLayout';
import LoadingSpinner from '@/components/LoadingSpinner';
import Toast, { useToast } from '@/components/Toast';

export default function TimesheetsDashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast, showToast, hideToast } = useToast();

  const {
    data: dashboardData,
    isLoading: loading,
    error
  } = useTimesheetDashboard(user?.authUser?.$id, user?.organizationId);

  const getStatusBadge = (status) => {
    const variants = {
      draft: 'secondary',
      submitted: 'warning',
      approved: 'success',
      rejected: 'danger'
    };
    return <Badge bg={variants[status] || 'secondary'}>{status?.toUpperCase() || 'DRAFT'}</Badge>;
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
        <Alert variant="danger">
          Failed to load dashboard data: {error.message}
        </Alert>
      </AppLayout>
    );
  }

  const { statusCounts, recentTimesheets, currentWeekStats } = dashboardData || {};

  return (
    <AppLayout user={user}>
      <Toast toast={toast} onClose={hideToast} />

      {/* Header */}
      <div className="mb-4">
        <h2>Timesheets Dashboard</h2>
        <p className="text-muted mb-0">Welcome back, {user?.firstName || user?.username}!</p>
      </div>

      {/* Current Week Alert */}
      {currentWeekStats && !currentWeekStats.exists && (
        <Alert variant="info" className="mb-4">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <strong>
                <i className="bi bi-info-circle me-2"></i>
                No timesheet for current week
              </strong>
              <p className="mb-0 mt-1 small">Start tracking your time for this week.</p>
            </div>
            <Button
              size="sm"
              variant="primary"
              onClick={() => router.push('/timesheets/my')}
            >
              Start Tracking
            </Button>
          </div>
        </Alert>
      )}

      {currentWeekStats?.exists && currentWeekStats.status === 'rejected' && (
        <Alert variant="danger" className="mb-4">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <strong>
                <i className="bi bi-exclamation-triangle me-2"></i>
                Current week timesheet was rejected
              </strong>
              <p className="mb-0 mt-1 small">Please review the feedback and resubmit.</p>
            </div>
            <Button
              size="sm"
              variant="danger"
              onClick={() => router.push('/timesheets/my')}
            >
              Review & Resubmit
            </Button>
          </div>
        </Alert>
      )}

      {/* Quick Actions */}
      <Card className="mb-4 border-0 shadow-sm">
        <Card.Body>
          <h5 className="mb-3">Quick Actions</h5>
          <Row>
            <Col md={4} className="mb-2 mb-md-0">
              <Button
                variant="primary"
                className="w-100"
                onClick={() => router.push('/timesheets/my')}
              >
                <i className="bi bi-clock-history me-2"></i>
                My Timesheets
              </Button>
            </Col>
            <Col md={4} className="mb-2 mb-md-0">
              <Button
                variant="outline-info"
                className="w-100"
                onClick={() => router.push('/timesheets/reports')}
              >
                <i className="bi bi-graph-up me-2"></i>
                Reports & Analytics
              </Button>
            </Col>
            {(user?.isAdmin || user?.isSupervisor) && (
              <Col md={4}>
                <Button
                  variant="outline-success"
                  className="w-100"
                  onClick={() => router.push('/timesheets/approvals')}
                >
                  <i className="bi bi-check-square me-2"></i>
                  Approvals
                </Button>
              </Col>
            )}
          </Row>
        </Card.Body>
      </Card>

      {/* Status Statistics */}
      <Row className="mb-4">
        <Col md={3} className="mb-3">
          <Card className="border-0 shadow-sm h-100">
            <Card.Body className="text-center">
              <div className="mb-2">
                <i className="bi bi-file-earmark-text text-secondary" style={{ fontSize: '2.5rem' }}></i>
              </div>
              <h3 className="mb-1">{statusCounts?.draft || 0}</h3>
              <div className="text-muted small">Draft</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} className="mb-3">
          <Card className="border-0 shadow-sm h-100">
            <Card.Body className="text-center">
              <div className="mb-2">
                <i className="bi bi-clock-history text-warning" style={{ fontSize: '2.5rem' }}></i>
              </div>
              <h3 className="mb-1">{statusCounts?.submitted || 0}</h3>
              <div className="text-muted small">Pending Approval</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} className="mb-3">
          <Card className="border-0 shadow-sm h-100">
            <Card.Body className="text-center">
              <div className="mb-2">
                <i className="bi bi-check-circle text-success" style={{ fontSize: '2.5rem' }}></i>
              </div>
              <h3 className="mb-1">{statusCounts?.approved || 0}</h3>
              <div className="text-muted small">Approved</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} className="mb-3">
          <Card className="border-0 shadow-sm h-100">
            <Card.Body className="text-center">
              <div className="mb-2">
                <i className="bi bi-x-circle text-danger" style={{ fontSize: '2.5rem' }}></i>
              </div>
              <h3 className="mb-1">{statusCounts?.rejected || 0}</h3>
              <div className="text-muted small">Rejected</div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Current Week Stats */}
      {currentWeekStats?.exists && (
        <Card className="mb-4 border-0 shadow-sm">
          <Card.Body>
            <h5 className="mb-3">Current Week Summary</h5>
            <Row>
              <Col md={3}>
                <div className="text-muted small mb-1">Week Starting</div>
                <div><strong>{formatDate(currentWeekStats.weekStart)}</strong></div>
              </Col>
              <Col md={3}>
                <div className="text-muted small mb-1">Status</div>
                <div>{getStatusBadge(currentWeekStats.status)}</div>
              </Col>
              <Col md={3}>
                <div className="text-muted small mb-1">Total Hours</div>
                <div><strong>{formatHours(currentWeekStats.totalHours)}</strong></div>
              </Col>
              <Col md={3}>
                <div className="text-muted small mb-1">Entries</div>
                <div><strong>{currentWeekStats.entriesCount}</strong></div>
              </Col>
            </Row>
          </Card.Body>
        </Card>
      )}

      {/* Recent Timesheets */}
      <Card className="border-0 shadow-sm">
        <Card.Body>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="mb-0">Recent Timesheets</h5>
            <Button
              variant="link"
              size="sm"
              onClick={() => router.push('/timesheets/my')}
            >
              View All <i className="bi bi-arrow-right ms-1"></i>
            </Button>
          </div>

          {!recentTimesheets || recentTimesheets.length === 0 ? (
            <div className="text-center py-5">
              <div className="mb-3">
                <i className="bi bi-inbox" style={{ fontSize: '4rem', opacity: 0.3 }}></i>
              </div>
              <h6>No Timesheets Yet</h6>
              <p className="text-muted">Start tracking your time to see your timesheets here.</p>
              <Button
                variant="primary"
                size="sm"
                onClick={() => router.push('/timesheets/my')}
              >
                Create Timesheet
              </Button>
            </div>
          ) : (
            <div className="table-responsive">
              <Table hover>
                <thead className="table-light">
                  <tr>
                    <th>Week Starting</th>
                    <th>Status</th>
                    <th>Hours</th>
                    <th>Entries</th>
                    <th>Submitted</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTimesheets.map((timesheet) => (
                    <tr key={timesheet.$id}>
                      <td>
                        <strong>{formatDate(timesheet.weekStart)}</strong>
                        <div className="small text-muted">
                          Week of {new Date(timesheet.weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                      </td>
                      <td>{getStatusBadge(timesheet.status)}</td>
                      <td>
                        <Badge bg="primary" className="fs-6">
                          {formatHours(timesheet.totalHours)}
                        </Badge>
                        {timesheet.billableHours > 0 && (
                          <div className="small text-muted mt-1">
                            {formatHours(timesheet.billableHours)} billable
                          </div>
                        )}
                      </td>
                      <td>{timesheet.entriesCount}</td>
                      <td>
                        <small className="text-muted">
                          {timesheet.submittedAt
                            ? new Date(timesheet.submittedAt).toLocaleDateString()
                            : '-'}
                        </small>
                      </td>
                      <td>
                        <Button
                          size="sm"
                          variant="outline-primary"
                          onClick={() => router.push(`/timesheets/${timesheet.$id}`)}
                        >
                          <i className="bi bi-eye"></i>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>
    </AppLayout>
  );
}
