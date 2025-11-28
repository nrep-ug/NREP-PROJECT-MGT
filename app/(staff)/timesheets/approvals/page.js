'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Table, Button, Badge, Modal, Form, Alert, Row, Col, ButtonGroup, InputGroup } from 'react-bootstrap';
import { useAuth } from '@/hooks/useAuth';
import { formatDate, formatHours } from '@/lib/date';
import AppLayout from '@/components/AppLayout';
import LoadingSpinner from '@/components/LoadingSpinner';
import Toast, { useToast } from '@/components/Toast';

export default function TimesheetsApprovalsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [timesheets, setTimesheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('submitted');
  const [searchQuery, setSearchQuery] = useState('');
  const [weekFilter, setWeekFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showBulkRejectModal, setShowBulkRejectModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showBulkApproveModal, setShowBulkApproveModal] = useState(false);
  const [selectedTimesheet, setSelectedTimesheet] = useState(null);
  const [rejectionComments, setRejectionComments] = useState('');
  const [approvalComments, setApprovalComments] = useState('');
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [bulkRejecting, setBulkRejecting] = useState(false);
  const { toast, showToast, hideToast } = useToast();

  // Access check is handled by the API
  // Admins, Project Managers, and Supervisors can access

  useEffect(() => {
    if (user?.organizationId) {
      loadTimesheets();
    }
  }, [user, statusFilter, weekFilter]);

  const loadTimesheets = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        organizationId: user.organizationId,
        requesterId: user.authUser.$id,
        ...(statusFilter && { status: statusFilter }),
        ...(weekFilter && { weekStart: weekFilter })
      });

      const response = await fetch(`/api/timesheets/approvals?${params}`);
      const data = await response.json();

      if (response.ok) {
        setTimesheets(data.timesheets || []);
        setSelectedIds([]); // Clear selections on reload
      } else {
        console.error('Failed to load timesheets:', data.error);
        const errorMessage = response.status === 403
          ? 'Access denied - only administrators, project managers, and supervisors can approve timesheets'
          : data.error || 'Failed to load timesheets';
        showToast(errorMessage, 'danger');
      }
    } catch (err) {
      console.error('Failed to load timesheets:', err);
      showToast('Failed to load timesheets', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (timesheet) => {
    // Navigate to dedicated details page
    router.push(`/timesheets/${timesheet.$id}`);
  };

  const openApproveModal = (timesheet) => {
    setSelectedTimesheet(timesheet);
    setApprovalComments('');
    setShowApproveModal(true);
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
          timesheetId: selectedTimesheet.$id,
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
      setApprovalComments('');
      setShowApproveModal(false);
      loadTimesheets();
    } catch (err) {
      showToast(err.message || 'Failed to approve timesheet', 'danger');
    } finally {
      setApproving(false);
    }
  };

  const openBulkApproveModal = () => {
    if (selectedIds.length === 0) {
      showToast('Please select timesheets to approve', 'warning');
      return;
    }
    setApprovalComments('');
    setShowBulkApproveModal(true);
  };

  const handleBulkApprove = async () => {
    if (!approvalComments.trim()) {
      showToast('Please provide approval comments', 'warning');
      return;
    }

    setBulkApproving(true);
    try {
      const response = await fetch('/api/timesheets/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timesheetIds: selectedIds,
          action: 'approve',
          managerId: user.authUser.$id,
          approvalComments
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to bulk approve');
      }

      showToast(data.message || 'Bulk approval completed!', 'success');
      setApprovalComments('');
      setShowBulkApproveModal(false);
      loadTimesheets();
    } catch (err) {
      showToast(err.message || 'Failed to bulk approve', 'danger');
    } finally {
      setBulkApproving(false);
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
          timesheetId: selectedTimesheet.$id,
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
      setRejectionComments('');
      setShowRejectModal(false);
      loadTimesheets();
    } catch (err) {
      showToast(err.message || 'Failed to reject timesheet', 'danger');
    } finally {
      setRejecting(false);
    }
  };

  const handleBulkReject = async () => {
    if (!rejectionComments.trim()) {
      showToast('Please provide rejection comments', 'warning');
      return;
    }

    setBulkRejecting(true);
    try {
      const response = await fetch('/api/timesheets/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timesheetIds: selectedIds,
          action: 'reject',
          managerId: user.authUser.$id,
          rejectionComments
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to bulk reject');
      }

      showToast(data.message || 'Bulk rejection completed!', 'success');
      setRejectionComments('');
      setShowBulkRejectModal(false);
      loadTimesheets();
    } catch (err) {
      showToast(err.message || 'Failed to bulk reject', 'danger');
    } finally {
      setBulkRejecting(false);
    }
  };

  const openRejectModal = (timesheet) => {
    setSelectedTimesheet(timesheet);
    setRejectionComments('');
    setShowRejectModal(true);
  };

  const openBulkRejectModal = () => {
    if (selectedIds.length === 0) {
      showToast('Please select timesheets to reject', 'warning');
      return;
    }
    setRejectionComments('');
    setShowBulkRejectModal(true);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredTimesheets.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredTimesheets.map(ts => ts.$id));
    }
  };

  const toggleSelectOne = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(sid => sid !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
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

  // Filter timesheets by search query
  const filteredTimesheets = timesheets.filter(ts => {
    if (!searchQuery) return true;

    const query = searchQuery.toLowerCase();
    const userName = `${ts.user?.firstName || ''} ${ts.user?.lastName || ''}`.toLowerCase();
    const username = ts.user?.username?.toLowerCase() || '';
    const projects = ts.summary?.projects?.map(p => p.name?.toLowerCase() || '').join(' ') || '';

    return userName.includes(query) || username.includes(query) || projects.includes(query);
  });

  if (authLoading || loading) {
    return (
      <AppLayout user={user}>
        <LoadingSpinner message="Loading timesheets..." />
      </AppLayout>
    );
  }

  return (
    <AppLayout user={user}>
      <Toast toast={toast} onClose={hideToast} />

      {/* Header */}
      <div className="mb-4">
        <h2>Timesheet Approvals</h2>
        <p className="text-muted mb-0">Review and approve team member timesheets</p>
      </div>

      {/* Filters and Search */}
      <Card className="mb-3 border-0 shadow-sm">
        <Card.Body>
          <Row className="align-items-center">
            <Col md={4}>
              <InputGroup size="sm">
                <InputGroup.Text>
                  <i className="bi bi-search"></i>
                </InputGroup.Text>
                <Form.Control
                  placeholder="Search by name or project..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </InputGroup>
            </Col>
            <Col md={5}>
              <ButtonGroup size="sm">
                <Button
                  variant={statusFilter === 'submitted' ? 'primary' : 'outline-primary'}
                  onClick={() => setStatusFilter('submitted')}
                >
                  Pending ({timesheets.filter(t => t.status === 'submitted').length})
                </Button>
                <Button
                  variant={statusFilter === 'approved' ? 'success' : 'outline-success'}
                  onClick={() => setStatusFilter('approved')}
                >
                  Approved
                </Button>
                <Button
                  variant={statusFilter === 'rejected' ? 'danger' : 'outline-danger'}
                  onClick={() => setStatusFilter('rejected')}
                >
                  Rejected
                </Button>
                <Button
                  variant={!statusFilter ? 'secondary' : 'outline-secondary'}
                  onClick={() => setStatusFilter('')}
                >
                  All
                </Button>
              </ButtonGroup>
            </Col>
            <Col md={3} className="text-end">
              <Button size="sm" variant="outline-secondary" onClick={loadTimesheets}>
                <i className="bi bi-arrow-clockwise me-2"></i>
                Refresh
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <Alert variant="info" className="d-flex justify-content-between align-items-center">
          <span>
            <strong>{selectedIds.length}</strong> timesheet(s) selected
          </span>
          <div>
            <Button size="sm" variant="success" onClick={openBulkApproveModal} className="me-2">
              <i className="bi bi-check-circle me-2"></i>
              Approve Selected
            </Button>
            <Button size="sm" variant="danger" onClick={openBulkRejectModal}>
              <i className="bi bi-x-circle me-2"></i>
              Reject Selected
            </Button>
          </div>
        </Alert>
      )}

      {/* Timesheets Table */}
      <Card className="border-0 shadow-sm">
        <Card.Body>
          {filteredTimesheets.length === 0 ? (
            <div className="text-center py-5">
              <div className="mb-3">
                <i className="bi bi-inbox" style={{ fontSize: '4rem', opacity: 0.3 }}></i>
              </div>
              <h5>No Timesheets Found</h5>
              <p className="text-muted">
                {searchQuery
                  ? 'No timesheets match your search'
                  : statusFilter === 'submitted'
                  ? 'No timesheets pending approval'
                  : 'No timesheets match the selected filter'}
              </p>
            </div>
          ) : (
            <div className="table-responsive">
              <Table hover>
                <thead className="table-light">
                  <tr>
                    <th style={{ width: '40px' }}>
                      <Form.Check
                        type="checkbox"
                        checked={selectedIds.length === filteredTimesheets.length && filteredTimesheets.length > 0}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th>Employee</th>
                    <th>Week</th>
                    <th>Total Hours</th>
                    <th>Billable</th>
                    <th>Projects</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTimesheets.map((ts) => (
                    <tr key={ts.$id}>
                      <td>
                        <Form.Check
                          type="checkbox"
                          checked={selectedIds.includes(ts.$id)}
                          onChange={() => toggleSelectOne(ts.$id)}
                        />
                      </td>
                      <td>
                        <div>
                          <strong>
                            {ts.user?.firstName} {ts.user?.lastName}
                          </strong>
                        </div>
                        <small className="text-muted">
                          @{ts.user?.username}
                        </small>
                        {ts.user?.title && (
                          <div className="small text-muted">{ts.user.title}</div>
                        )}
                      </td>
                      <td>
                        <div>{formatDate(ts.weekStart)}</div>
                        <small className="text-muted">
                          Week of {new Date(ts.weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </small>
                      </td>
                      <td>
                        <Badge bg="primary" className="fs-6">
                          {formatHours(ts.summary?.totalHours || 0)}
                        </Badge>
                      </td>
                      <td>
                        <Badge bg="success" className="fs-6">
                          {formatHours(ts.summary?.billableHours || 0)}
                        </Badge>
                        <div className="small text-muted">
                          {ts.summary?.nonBillableHours > 0 && (
                            <>{formatHours(ts.summary.nonBillableHours)} non-billable</>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="small">
                          {ts.summary?.projects?.slice(0, 2).map((p, idx) => (
                            <Badge key={idx} bg="secondary" className="me-1 mb-1">
                              {p.code || p.name}
                            </Badge>
                          ))}
                          {ts.summary?.projects?.length > 2 && (
                            <Badge bg="light" text="dark">
                              +{ts.summary.projects.length - 2} more
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td>{getStatusBadge(ts.status)}</td>
                      <td>
                        <small className="text-muted">
                          {ts.submittedAt
                            ? new Date(ts.submittedAt).toLocaleDateString()
                            : '-'}
                        </small>
                      </td>
                      <td>
                        <div className="d-flex gap-1">
                          <Button
                            size="sm"
                            variant="outline-primary"
                            onClick={() => handleViewDetails(ts)}
                            title="View details"
                          >
                            <i className="bi bi-eye"></i>
                          </Button>
                          {ts.status === 'submitted' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline-success"
                                onClick={() => openApproveModal(ts)}
                                title="Approve"
                              >
                                <i className="bi bi-check"></i>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline-danger"
                                onClick={() => openRejectModal(ts)}
                                title="Reject"
                              >
                                <i className="bi bi-x"></i>
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Single Reject Modal */}
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

      {/* Bulk Reject Modal */}
      <Modal show={showBulkRejectModal} onHide={() => setShowBulkRejectModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Bulk Reject Timesheets</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="warning">
            <strong>Important:</strong> You are about to reject {selectedIds.length} timesheet(s). The same feedback will be sent to all selected employees.
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
              All selected employees will see these comments when viewing their rejected timesheets.
            </Form.Text>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowBulkRejectModal(false)} disabled={bulkRejecting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleBulkReject}
            disabled={!rejectionComments.trim() || bulkRejecting}
          >
            {bulkRejecting ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Rejecting...
              </>
            ) : (
              <>
                <i className="bi bi-x-circle me-2"></i>
                Reject {selectedIds.length} Timesheet(s)
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Single Approve Modal */}
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

      {/* Bulk Approve Modal */}
      <Modal show={showBulkApproveModal} onHide={() => setShowBulkApproveModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Bulk Approve Timesheets</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="success">
            <strong>Bulk Approval:</strong> You are about to approve {selectedIds.length} timesheet(s). The same comments will be sent to all selected employees.
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
              All selected employees will see these comments when viewing their approved timesheets.
            </Form.Text>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowBulkApproveModal(false)} disabled={bulkApproving}>
            Cancel
          </Button>
          <Button
            variant="success"
            onClick={handleBulkApprove}
            disabled={!approvalComments.trim() || bulkApproving}
          >
            {bulkApproving ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Approving...
              </>
            ) : (
              <>
                <i className="bi bi-check-circle me-2"></i>
                Approve {selectedIds.length} Timesheet(s)
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </AppLayout>
  );
}
