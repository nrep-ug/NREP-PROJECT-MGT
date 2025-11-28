'use client';

import { Card, Row, Col } from 'react-bootstrap';
import { formatHours } from '@/lib/date';

/**
 * Timesheet Summary Component
 * Display summary statistics for the timesheet
 */
export default function TimesheetSummary({ entries }) {
  // Calculate totals
  const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);
  const billableHours = entries.reduce((sum, e) => e.billable ? sum + e.hours : sum, 0);
  const nonBillableHours = totalHours - billableHours;

  // Get unique project count
  const projectCount = [...new Set(entries.map(e => e.projectId))].length;

  return (
    <Card className="border-0 shadow-sm mb-3">
      <Card.Body>
        <Row className="g-3 g-md-0">
          {/* Total Hours */}
          <Col xs={6} md={3} className="text-center">
            <div className="text-muted small mb-1">Total Hours</div>
            <h3 className="mb-0 text-primary">{formatHours(totalHours)}</h3>
          </Col>

          {/* Billable Hours */}
          <Col xs={6} md={3} className="text-center border-start">
            <div className="text-muted small mb-1">Billable</div>
            <h3 className="mb-0 text-success">{formatHours(billableHours)}</h3>
          </Col>

          {/* Non-Billable Hours */}
          <Col xs={6} md={3} className="text-center border-start">
            <div className="text-muted small mb-1">Non-Billable</div>
            <h3 className="mb-0 text-secondary">{formatHours(nonBillableHours)}</h3>
          </Col>

          {/* Projects */}
          <Col xs={6} md={3} className="text-center border-start">
            <div className="text-muted small mb-1">Projects</div>
            <h3 className="mb-0 text-info">{projectCount}</h3>
          </Col>
        </Row>

        {entries.length === 0 && (
          <div className="text-center text-muted mt-3 pt-3 border-top">
            <i className="bi bi-clock-history fs-4 d-block mb-2"></i>
            <p className="mb-0">No time entries yet. Add your first entry to get started!</p>
          </div>
        )}
      </Card.Body>
    </Card>
  );
}
