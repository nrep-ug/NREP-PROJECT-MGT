'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, Table, Badge, Button, Alert, Row, Col, Modal, Form } from 'react-bootstrap';
import { useAuth } from '@/hooks/useAuth';
import { formatDate, formatHours } from '@/lib/date';
import AppLayout from '@/components/AppLayout';
import LoadingSpinner from '@/components/LoadingSpinner';
import Toast, { useToast } from '@/components/Toast';

export default function TimesheetDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [timesheet, setTimesheet] = useState(null);
  const [entries, setEntries] = useState([]);
  const [projects, setProjects] = useState({});
  const [loading, setLoading] = useState(true);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [approvalComments, setApprovalComments] = useState('');
  const [rejectionComments, setRejectionComments] = useState('');
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const { toast, showToast, hideToast } = useToast();

  const timesheetId = params.timesheetId;

  useEffect(() => {
    if (user?.organizationId && timesheetId) {
      loadTimesheetDetails();
    }
  }, [user, timesheetId]);

  const loadTimesheetDetails = async () => {
    try {
      setLoading(true);

      // Fetch timesheet details
      const response = await fetch(`/api/timesheets/details?timesheetId=${timesheetId}`);
      const data = await response.json();

      if (response.ok) {
        setTimesheet(data.timesheet);
        setEntries(data.entries || []);

        // Create projects map for quick lookup
        const projectsMap = {};
        data.entries?.forEach(entry => {
          if (entry.project) {
            projectsMap[entry.projectId] = entry.project;
          }
        });
        setProjects(projectsMap);
      } else {
        showToast(data.error || 'Failed to load timesheet details', 'danger');
      }
    } catch (err) {
      console.error('Failed to load timesheet details:', err);
      showToast('Failed to load timesheet details', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!approvalComments.trim()) {
      showToast('Please provide approval comments', 'warning');
      return;
    }

    setApproving(true);
    try {
      const response = await fetch('/api/timesheets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timesheetId: timesheet.$id,
          action: 'approve',
          managerId: user.authUser.$id,
          approvalComments
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to approve timesheet');
      }

      showToast('Timesheet approved successfully!', 'success');
      setShowApproveModal(false);

      // Reload timesheet to show updated status
      await loadTimesheetDetails();
    } catch (err) {
      showToast(err.message || 'Failed to approve timesheet', 'danger');
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionComments.trim()) {
      showToast('Please provide rejection comments', 'warning');
      return;
    }

    setRejecting(true);
    try {
      const response = await fetch('/api/timesheets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timesheetId: timesheet.$id,
          action: 'reject',
          managerId: user.authUser.$id,
          rejectionComments
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reject timesheet');
      }

      showToast('Timesheet rejected with feedback', 'success');
      setShowRejectModal(false);

      // Reload timesheet to show updated status
      await loadTimesheetDetails();
    } catch (err) {
      showToast(err.message || 'Failed to reject timesheet', 'danger');
    } finally {
      setRejecting(false);
    }
  };

  const handleEditEntry = (entry) => {
    const params = new URLSearchParams({
      entryId: entry.$id,
      weekStart: timesheet.weekStart,
      weekEnd: timesheet.weekStart, // Will be calculated from weekStart
    });
    router.push(`/timesheets/entry?${params.toString()}`);
  };

  const handleDeleteEntry = async (entry) => {
    if (!confirm(`Delete this ${formatHours(entry.hours)} time entry?`)) {
      return;
    }

    try {
      const response = await fetch(
        `/api/timesheets/entries/${entry.$id}?requesterId=${user.authUser.$id}`,
        { method: 'DELETE' }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete entry');
      }

      showToast('Entry deleted successfully!', 'success');
      // Reload timesheet details
      await loadTimesheetDetails();
    } catch (err) {
      showToast(err.message || 'Failed to delete entry', 'danger');
    }
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

  // Group entries by date
  const entriesByDate = entries.reduce((acc, entry) => {
    const date = entry.workDate;
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(entry);
    return acc;
  }, {});

  const sortedDates = Object.keys(entriesByDate).sort();

  // Calculate totals
  const totalHours = entries.reduce((sum, entry) => sum + entry.hours, 0);
  const billableHours = entries.reduce((sum, entry) => entry.billable ? sum + entry.hours : sum, 0);
  const nonBillableHours = totalHours - billableHours;

  // Get unique projects
  const uniqueProjects = Object.values(projects);

  if (authLoading || loading) {
    return (
      <AppLayout user={user}>
        <LoadingSpinner message="Loading timesheet details..." />
      </AppLayout>
    );
  }

  if (!timesheet) {
    return (
      <AppLayout user={user}>
        <Alert variant="danger">Timesheet not found</Alert>
        <Button onClick={() => router.back()}>Go Back</Button>
      </AppLayout>
    );
  }

  // Check if user can approve (admin, supervisor of the employee, or manager of projects)
  const canApprove = user?.isAdmin ||
                     user?.isSupervisor ||
                     (timesheet.status === 'submitted');

  // Check if user can edit (owner and timesheet is draft or rejected)
  const isOwner = timesheet?.accountId === user?.authUser?.$id;
  const canEdit = isOwner && (timesheet?.status === 'draft' || timesheet?.status === 'rejected');

  return (
    <AppLayout user={user}>
      <Toast toast={toast} onClose={hideToast} />

      {/* Header with back button */}
      <div className="mb-4 d-flex justify-content-between align-items-center">
        <div>
          <Button variant="outline-secondary" size="sm" onClick={() => router.back()} className="mb-2">
            <i className="bi bi-arrow-left me-2"></i>
            {isOwner ? 'Back to My Timesheets' : 'Back'}
          </Button>
          <h2 className="mb-1">Timesheet Details</h2>
          <p className="text-muted mb-0">
            {timesheet.user?.firstName} {timesheet.user?.lastName} - Week of {formatDate(timesheet.weekStart)}
          </p>
        </div>
        <div>
          {getStatusBadge(timesheet.status)}
        </div>
      </div>

      {/* Employee Info Card */}
      <Card className="mb-3 border-0 shadow-sm">
        <Card.Body>
          <Row>
            <Col md={6}>
              <h6 className="text-muted mb-3">Employee Information</h6>
              <div className="mb-2">
                <strong>Name:</strong> {timesheet.user?.firstName} {timesheet.user?.lastName}
              </div>
              <div className="mb-2">
                <strong>Username:</strong> @{timesheet.user?.username}
              </div>
              {timesheet.user?.title && (
                <div className="mb-2">
                  <strong>Title:</strong> {timesheet.user.title}
                </div>
              )}
              {timesheet.user?.department && (
                <div className="mb-2">
                  <strong>Department:</strong> {timesheet.user.department}
                </div>
              )}
            </Col>
            <Col md={6}>
              <h6 className="text-muted mb-3">Timesheet Information</h6>
              <div className="mb-2">
                <strong>Week Start:</strong> {formatDate(timesheet.weekStart)}
              </div>
              <div className="mb-2">
                <strong>Status:</strong> {getStatusBadge(timesheet.status)}
              </div>
              {timesheet.submittedAt && (
                <div className="mb-2">
                  <strong>Submitted:</strong> {new Date(timesheet.submittedAt).toLocaleString()}
                </div>
              )}
              {timesheet.approvedAt && (
                <div className="mb-2">
                  <strong>Approved:</strong> {new Date(timesheet.approvedAt).toLocaleString()}
                </div>
              )}
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Summary Cards */}
      <Row className="mb-4">
        <Col md={3}>
          <Card className="text-center border-0 shadow-sm">
            <Card.Body>
              <div className="text-muted small mb-2">Total Hours</div>
              <h3 className="mb-0">{formatHours(totalHours)}</h3>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center border-0 shadow-sm">
            <Card.Body>
              <div className="text-muted small mb-2">Billable Hours</div>
              <h3 className="mb-0 text-success">{formatHours(billableHours)}</h3>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center border-0 shadow-sm">
            <Card.Body>
              <div className="text-muted small mb-2">Non-Billable Hours</div>
              <h3 className="mb-0 text-secondary">{formatHours(nonBillableHours)}</h3>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center border-0 shadow-sm">
            <Card.Body>
              <div className="text-muted small mb-2">Total Entries</div>
              <h3 className="mb-0">{entries.length}</h3>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Projects Involved */}
      {uniqueProjects.length > 0 && (
        <Card className="mb-3 border-0 shadow-sm">
          <Card.Body>
            <h6 className="mb-3">Projects Involved</h6>
            <div className="d-flex flex-wrap gap-2">
              {uniqueProjects.map(project => (
                <Badge key={project.$id} bg="primary" className="fs-6">
                  {project.code || project.name}
                </Badge>
              ))}
            </div>
          </Card.Body>
        </Card>
      )}

      {/* Comments */}
      {timesheet.approvalComments && (
        <Alert variant="success" className="mb-3">
          <strong>Approval Comments:</strong>
          <p className="mb-0 mt-2">{timesheet.approvalComments}</p>
        </Alert>
      )}

      {timesheet.rejectionComments && (
        <Alert variant="danger" className="mb-3">
          <strong>Rejection Comments:</strong>
          <p className="mb-0 mt-2">{timesheet.rejectionComments}</p>
        </Alert>
      )}

      {/* Time Entries */}
      <Card className="mb-4 border-0 shadow-sm">
        <Card.Body>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="mb-0">Time Entries</h5>
            {canEdit && (
              <Button
                size="sm"
                variant="primary"
                onClick={() => router.push(`/timesheets/entry?weekStart=${timesheet.weekStart}`)}
              >
                <i className="bi bi-plus-circle me-2"></i>
                Add Entry
              </Button>
            )}
          </div>

          {entries.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-muted">No time entries found</p>
            </div>
          ) : (
            <div className="table-responsive">
              <Table hover>
                <thead className="table-light">
                  <tr>
                    <th>Date</th>
                    <th>Project</th>
                    <th>Hours</th>
                    <th>Billable</th>
                    <th>Notes</th>
                    {canEdit && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {sortedDates.map(date => (
                    entriesByDate[date].map((entry, idx) => (
                      <tr key={entry.$id}>
                        {idx === 0 && (
                          <td rowSpan={entriesByDate[date].length} className="align-middle">
                            <strong>{formatDate(entry.workDate)}</strong>
                            <div className="small text-muted">
                              {new Date(entry.workDate).toLocaleDateString('en-US', { weekday: 'long' })}
                            </div>
                          </td>
                        )}
                        <td>
                          <div>{projects[entry.projectId]?.name || 'Unknown Project'}</div>
                          {projects[entry.projectId]?.code && (
                            <small className="text-muted">{projects[entry.projectId].code}</small>
                          )}
                        </td>
                        <td>
                          <Badge bg="primary">{formatHours(entry.hours)}</Badge>
                        </td>
                        <td>
                          {entry.billable ? (
                            <Badge bg="success">Yes</Badge>
                          ) : (
                            <Badge bg="secondary">No</Badge>
                          )}
                        </td>
                        <td>
                          <small>{entry.notes || '-'}</small>
                        </td>
                        {canEdit && (
                          <td>
                            <div className="d-flex gap-1">
                              <Button
                                size="sm"
                                variant="outline-primary"
                                onClick={() => handleEditEntry(entry)}
                                title="Edit entry"
                              >
                                <i className="bi bi-pencil"></i>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline-danger"
                                onClick={() => handleDeleteEntry(entry)}
                                title="Delete entry"
                              >
                                <i className="bi bi-trash"></i>
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Action Buttons */}
      {canApprove && timesheet.status === 'submitted' && (
        <Card className="border-0 shadow-sm">
          <Card.Body>
            <h6 className="mb-3">Actions</h6>
            <div className="d-flex gap-2">
              <Button
                variant="success"
                onClick={() => setShowApproveModal(true)}
              >
                <i className="bi bi-check-circle me-2"></i>
                Approve Timesheet
              </Button>
              <Button
                variant="danger"
                onClick={() => setShowRejectModal(true)}
              >
                <i className="bi bi-x-circle me-2"></i>
                Reject Timesheet
              </Button>
            </div>
          </Card.Body>
        </Card>
      )}

      {/* Approve Modal */}
      <Modal show={showApproveModal} onHide={() => setShowApproveModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Approve Timesheet</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="success">
            <strong>Approval:</strong> Please provide comments about this timesheet approval.
          </Alert>

          <Form.Group>
            <Form.Label>Approval Comments *</Form.Label>
            <Form.Control
              as="textarea"
              rows={4}
              value={approvalComments}
              onChange={(e) => setApprovalComments(e.target.value)}
              placeholder="Add any notes about this approval..."
              required
            />
            <Form.Text className="text-muted">
              The employee will see these comments when viewing their approved timesheet.
            </Form.Text>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowApproveModal(false)} disabled={approving}>
            Cancel
          </Button>
          <Button
            variant="success"
            onClick={handleApprove}
            disabled={!approvalComments.trim() || approving}
          >
            {approving ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Approving...
              </>
            ) : (
              <>
                <i className="bi bi-check-circle me-2"></i>
                Approve Timesheet
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Reject Modal */}
      <Modal show={showRejectModal} onHide={() => setShowRejectModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Reject Timesheet</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="warning">
            <strong>Important:</strong> Please provide clear feedback explaining why this timesheet is being rejected.
          </Alert>

          <Form.Group>
            <Form.Label>Rejection Comments *</Form.Label>
            <Form.Control
              as="textarea"
              rows={4}
              value={rejectionComments}
              onChange={(e) => setRejectionComments(e.target.value)}
              placeholder="Explain what needs to be corrected..."
              required
            />
            <Form.Text className="text-muted">
              The employee will see these comments when viewing their rejected timesheet.
            </Form.Text>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowRejectModal(false)} disabled={rejecting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleReject}
            disabled={!rejectionComments.trim() || rejecting}
          >
            {rejecting ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Rejecting...
              </>
            ) : (
              <>
                <i className="bi bi-x-circle me-2"></i>
                Reject Timesheet
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </AppLayout>
  );
}
