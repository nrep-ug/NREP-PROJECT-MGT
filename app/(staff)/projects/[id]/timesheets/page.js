'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, Table, Badge, Button, Row, Col, Form, ButtonGroup } from 'react-bootstrap';
import { useAuth } from '@/hooks/useAuth';
import { formatDate, formatHours, getWeekStart } from '@/lib/date';
import AppLayout from '@/components/AppLayout';
import LoadingSpinner from '@/components/LoadingSpinner';
import Toast, { useToast } from '@/components/Toast';

export default function ProjectTimesheetsPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [project, setProject] = useState(null);
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const { toast, showToast, hideToast } = useToast();

  useEffect(() => {
    if (user) {
      loadProjectTimesheets();
    }
  }, [user, statusFilter, userFilter, startDate, endDate]);

  const loadProjectTimesheets = async () => {
    try {
      setLoading(true);

      const queryParams = new URLSearchParams({
        requesterId: user.authUser.$id,
      });

      if (statusFilter) queryParams.append('status', statusFilter);
      if (userFilter) queryParams.append('userId', userFilter);
      if (startDate) queryParams.append('startDate', startDate);
      if (endDate) queryParams.append('endDate', endDate);

      const response = await fetch(`/api/projects/${params.id}/timesheets?${queryParams}`);
      const data = await response.json();

      if (response.ok) {
        setProject(data.project);
        setEntries(data.entries || []);
        setSummary(data.summary);
      } else {
        showToast(data.error || 'Failed to load project timesheets', 'danger');
      }
    } catch (err) {
      console.error('Failed to load project timesheets:', err);
      showToast('Failed to load project timesheets', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setStatusFilter('');
    setUserFilter('');
    setStartDate('');
    setEndDate('');
  };

  const getStatusBadge = (status) => {
    const variants = {
      draft: 'secondary',
      submitted: 'warning',
      approved: 'success',
      rejected: 'danger'
    };
    return <Badge bg={variants[status] || 'secondary'}>{status?.toUpperCase() || 'DRAFT'}</Badge>;
  };

  // Get unique users for filter dropdown
  const uniqueUsers = summary?.userSummaries || [];

  if (authLoading || loading) {
    return (
      <AppLayout user={user}>
        <LoadingSpinner message="Loading project timesheets..." />
      </AppLayout>
    );
  }

  return (
    <AppLayout user={user}>
      <Toast toast={toast} onClose={hideToast} />

      {/* Header */}
      <div className="mb-4">
        <div className="d-flex align-items-center mb-2">
          <Button
            variant="link"
            onClick={() => router.push(`/projects/${params.id}`)}
            className="p-0 me-3"
          >
            <i className="bi bi-arrow-left fs-4"></i>
          </Button>
          <div>
            <h2 className="mb-0">Project Time Tracking</h2>
            {project && (
              <p className="text-muted mb-0">
                {project.code && `[${project.code}] `}{project.name}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <Row className="mb-4">
          <Col md={3}>
            <Card className="border-0 shadow-sm">
              <Card.Body className="text-center">
                <div className="text-muted small mb-1">Total Hours</div>
                <h3 className="mb-0 text-primary">{formatHours(summary.totalHours)}</h3>
              </Card.Body>
            </Card>
          </Col>
          <Col md={3}>
            <Card className="border-0 shadow-sm">
              <Card.Body className="text-center">
                <div className="text-muted small mb-1">Billable</div>
                <h3 className="mb-0 text-success">{formatHours(summary.billableHours)}</h3>
              </Card.Body>
            </Card>
          </Col>
          <Col md={3}>
            <Card className="border-0 shadow-sm">
              <Card.Body className="text-center">
                <div className="text-muted small mb-1">Team Members</div>
                <h3 className="mb-0">{summary.uniqueUsers}</h3>
              </Card.Body>
            </Card>
          </Col>
          <Col md={3}>
            <Card className="border-0 shadow-sm">
              <Card.Body className="text-center">
                <div className="text-muted small mb-1">Entries</div>
                <h3 className="mb-0">{summary.entriesCount}</h3>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* Filters */}
      <Card className="mb-3 border-0 shadow-sm">
        <Card.Body>
          <Row className="align-items-end">
            <Col md={2}>
              <Form.Group>
                <Form.Label className="small">Status</Form.Label>
                <Form.Select
                  size="sm"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  <option value="draft">Draft</option>
                  <option value="submitted">Submitted</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group>
                <Form.Label className="small">Team Member</Form.Label>
                <Form.Select
                  size="sm"
                  value={userFilter}
                  onChange={(e) => setUserFilter(e.target.value)}
                >
                  <option value="">All Members</option>
                  {uniqueUsers.map((userSummary) => (
                    <option key={userSummary.user.accountId} value={userSummary.user.accountId}>
                      {userSummary.user.firstName} {userSummary.user.lastName}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={2}>
              <Form.Group>
                <Form.Label className="small">Start Date</Form.Label>
                <Form.Control
                  type="date"
                  size="sm"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </Form.Group>
            </Col>
            <Col md={2}>
              <Form.Group>
                <Form.Label className="small">End Date</Form.Label>
                <Form.Control
                  type="date"
                  size="sm"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </Form.Group>
            </Col>
            <Col md={3} className="text-end">
              <Button size="sm" variant="outline-secondary" onClick={clearFilters}>
                <i className="bi bi-x-circle me-2"></i>
                Clear Filters
              </Button>
              <Button size="sm" variant="outline-primary" onClick={loadProjectTimesheets} className="ms-2">
                <i className="bi bi-arrow-clockwise me-2"></i>
                Refresh
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* User Summaries */}
      {summary?.userSummaries && summary.userSummaries.length > 0 && (
        <Card className="mb-3 border-0 shadow-sm">
          <Card.Header className="bg-white">
            <h6 className="mb-0">Team Member Summary</h6>
          </Card.Header>
          <Card.Body className="p-0">
            <div className="table-responsive">
              <Table className="mb-0" size="sm">
                <thead className="table-light">
                  <tr>
                    <th>Team Member</th>
                    <th className="text-center">Total Hours</th>
                    <th className="text-center">Billable</th>
                    <th className="text-center">Entries</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.userSummaries.map((userSummary) => (
                    <tr key={userSummary.user.accountId}>
                      <td>
                        <div>
                          <strong>
                            {userSummary.user.firstName} {userSummary.user.lastName}
                          </strong>
                        </div>
                        <small className="text-muted">@{userSummary.user.username}</small>
                      </td>
                      <td className="text-center">
                        <Badge bg="primary">{formatHours(userSummary.totalHours)}</Badge>
                      </td>
                      <td className="text-center">
                        <Badge bg="success">{formatHours(userSummary.billableHours)}</Badge>
                      </td>
                      <td className="text-center">{userSummary.entriesCount}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card.Body>
        </Card>
      )}

      {/* Time Entries Table */}
      <Card className="border-0 shadow-sm">
        <Card.Header className="bg-white">
          <h6 className="mb-0">Time Entries ({entries.length})</h6>
        </Card.Header>
        <Card.Body className="p-0">
          {entries.length === 0 ? (
            <div className="text-center py-5">
              <i className="bi bi-inbox" style={{ fontSize: '4rem', opacity: 0.3 }}></i>
              <h5 className="mt-3">No Time Entries</h5>
              <p className="text-muted">
                {statusFilter || userFilter || startDate || endDate
                  ? 'No entries match the selected filters'
                  : 'No time has been logged to this project yet'}
              </p>
            </div>
          ) : (
            <div className="table-responsive">
              <Table hover className="mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Date</th>
                    <th>Team Member</th>
                    <th>Hours</th>
                    <th>Billable</th>
                    <th>Task</th>
                    <th>Notes</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.$id}>
                      <td>
                        <div>{formatDate(entry.workDate, 'MMM DD, YYYY')}</div>
                        <small className="text-muted">
                          {formatDate(entry.workDate, 'ddd')}
                        </small>
                      </td>
                      <td>
                        {entry.user ? (
                          <div>
                            <div>
                              <strong>
                                {entry.user.firstName} {entry.user.lastName}
                              </strong>
                            </div>
                            <small className="text-muted">@{entry.user.username}</small>
                          </div>
                        ) : (
                          <span className="text-muted">Unknown User</span>
                        )}
                      </td>
                      <td>
                        <Badge bg="primary" className="fs-6">
                          {formatHours(entry.hours)}
                        </Badge>
                      </td>
                      <td>
                        {entry.billable ? (
                          <Badge bg="success">Yes</Badge>
                        ) : (
                          <Badge bg="secondary">No</Badge>
                        )}
                      </td>
                      <td>
                        {entry.task ? (
                          <div>
                            <small className="text-muted">{entry.task.title}</small>
                          </div>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                      <td>
                        <small className="text-muted">
                          {entry.notes || '-'}
                        </small>
                      </td>
                      <td>{getStatusBadge(entry.timesheet.status)}</td>
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
