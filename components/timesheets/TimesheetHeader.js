'use client';

import { Button, Badge, ButtonGroup } from 'react-bootstrap';
import { formatDate } from '@/lib/date';

/**
 * Timesheet Header Component
 * Week navigation, status display, and action buttons
 */
export default function TimesheetHeader({
  timesheet,
  weekStart,
  weekEnd,
  canEdit,
  onPreviousWeek,
  onNextWeek,
  onSubmit,
  onUnsubmit,
  submitting = false
}) {
  const getStatusBadge = (status) => {
    const variants = {
      draft: 'secondary',
      submitted: 'warning',
      approved: 'success',
      rejected: 'danger'
    };
    return (
      <Badge bg={variants[status] || 'secondary'} className="fs-6">
        {status?.toUpperCase() || 'DRAFT'}
      </Badge>
    );
  };

  const isNextWeekDisabled = () => {
    const nextWeek = new Date(weekStart);
    nextWeek.setDate(nextWeek.getDate() + 7);
    return nextWeek > new Date();
  };

  return (
    <div className="mb-4">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start gap-3">
        {/* Left: Title and week navigation */}
        <div className="w-100 w-md-auto">
          <h2>My Timesheets</h2>
          <div className="d-flex flex-column flex-sm-row align-items-start align-items-sm-center gap-2 gap-sm-3 mt-2">
            <ButtonGroup size="sm">
              <Button variant="outline-primary" onClick={onPreviousWeek}>
                <i className="bi bi-chevron-left"></i>
              </Button>
              <Button variant="outline-primary" disabled className="text-nowrap">
                Week of {formatDate(weekStart, 'MMM DD, YYYY')}
              </Button>
              <Button
                variant="outline-primary"
                onClick={onNextWeek}
                disabled={isNextWeekDisabled()}
              >
                <i className="bi bi-chevron-right"></i>
              </Button>
            </ButtonGroup>
            <div className="text-muted small">
              {formatDate(weekStart)} - {formatDate(weekEnd)}
            </div>
          </div>
        </div>

        {/* Right: Status and actions */}
        <div className="text-start text-md-end">
          {timesheet && (
            <div className="mb-2">
              {getStatusBadge(timesheet.status)}
            </div>
          )}

          {canEdit && timesheet?.status === 'draft' && (
            <Button
              variant="success"
              size="sm"
              onClick={onSubmit}
              disabled={submitting}
              className="w-100 w-md-auto"
            >
              {submitting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Submitting...
                </>
              ) : (
                <>
                  <i className="bi bi-check-circle me-2"></i>
                  Submit for Approval
                </>
              )}
            </Button>
          )}

          {canEdit && timesheet?.status === 'rejected' && (
            <Button
              variant="success"
              size="sm"
              onClick={onSubmit}
              disabled={submitting}
              className="w-100 w-md-auto"
            >
              {submitting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Resubmitting...
                </>
              ) : (
                <>
                  <i className="bi bi-arrow-clockwise me-2"></i>
                  Resubmit for Approval
                </>
              )}
            </Button>
          )}

          {canEdit && timesheet?.status === 'submitted' && (
            <Button
              variant="warning"
              size="sm"
              onClick={onUnsubmit}
              disabled={submitting}
              className="w-100 w-md-auto"
            >
              {submitting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Processing...
                </>
              ) : (
                <>
                  <i className="bi bi-arrow-counterclockwise me-2"></i>
                  Unsubmit
                </>
              )}
            </Button>
          )}

          {timesheet?.status === 'approved' && (
            <div className="small text-muted mt-1">
              Approved {timesheet.approvedAt && `on ${formatDate(timesheet.approvedAt)}`}
            </div>
          )}

          {timesheet?.status === 'rejected' && (
            <div className="small text-danger mt-1">
              Rejected - Review feedback below
            </div>
          )}
        </div>
      </div>

      {/* Approval feedback */}
      {timesheet?.approvalComments && (
        <div className="alert alert-success mt-3 mb-0">
          <strong>
            <i className="bi bi-check-circle me-2"></i>
            Approval Comments:
          </strong>
          <p className="mb-0 mt-2">{timesheet.approvalComments}</p>
        </div>
      )}

      {/* Rejection feedback */}
      {timesheet?.rejectionComments && (
        <div className="alert alert-danger mt-3 mb-0">
          <strong>
            <i className="bi bi-exclamation-triangle me-2"></i>
            Rejection Feedback:
          </strong>
          <p className="mb-0 mt-2">{timesheet.rejectionComments}</p>
          <div className="mt-2 small">
            <i className="bi bi-info-circle me-1"></i>
            Please review the feedback above, make necessary changes, and resubmit your timesheet.
          </div>
        </div>
      )}
    </div>
  );
}
