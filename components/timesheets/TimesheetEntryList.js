'use client';

import React from 'react';
import { Card, Table, Badge, Button } from 'react-bootstrap';
import { formatDate, formatHours } from '@/lib/date';

/**
 * Timesheet Entry List Component
 * Display entries in a list/table format
 */
export default function TimesheetEntryList({
  entries,
  projects,
  canEdit,
  onEditEntry,
  onDeleteEntry
}) {
  // Group entries by date
  const entriesByDate = {};
  entries.forEach(entry => {
    if (!entriesByDate[entry.workDate]) {
      entriesByDate[entry.workDate] = [];
    }
    entriesByDate[entry.workDate].push(entry);
  });

  const dates = Object.keys(entriesByDate).sort();

  const getProjectName = (projectId) => {
    const project = projects.find(p => p.$id === projectId);
    return project ? project.name : 'Unknown Project';
  };

  const getProjectCode = (projectId) => {
    const project = projects.find(p => p.$id === projectId);
    return project?.code;
  };

  if (entries.length === 0) {
    return (
      <Card className="border-0 shadow-sm">
        <Card.Body className="py-5 text-center">
          <i className="bi bi-inbox" style={{ fontSize: '4rem', opacity: 0.3 }}></i>
          <h5 className="mt-3">No Time Entries</h5>
          <p className="text-muted">
            {canEdit ? 'Click "Add Entry" to log your time' : 'No entries for this week'}
          </p>
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-sm">
      <Card.Body className="p-0">
        <div className="table-responsive">
          <Table className="mb-0" hover>
            <thead className="table-light">
              <tr>
                <th>Date</th>
                <th>Project</th>
                <th>Hours</th>
                <th>Billable</th>
                <th>Notes</th>
                {canEdit && <th className="text-center" style={{ width: '100px' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {dates.map((date) => {
                const dayEntries = entriesByDate[date];
                const dayTotal = dayEntries.reduce((sum, e) => sum + e.hours, 0);

                return (
                  <React.Fragment key={date}>
                    {dayEntries.map((entry, idx) => (
                      <tr key={entry.$id}>
                        {/* Date column - only show on first entry of the day */}
                        {idx === 0 && (
                          <td rowSpan={dayEntries.length} className="align-middle">
                            <div>
                              <strong>{formatDate(date, 'ddd, MMM DD')}</strong>
                            </div>
                            <div className="small text-muted">
                              Total: <Badge bg="dark">{formatHours(dayTotal)}</Badge>
                            </div>
                          </td>
                        )}

                        {/* Project */}
                        <td>
                          <div>
                            <strong>{getProjectName(entry.projectId)}</strong>
                            {getProjectCode(entry.projectId) && (
                              <Badge bg="secondary" className="ms-2 small">
                                {getProjectCode(entry.projectId)}
                              </Badge>
                            )}
                          </div>
                          {entry.taskId && (
                            <div className="small text-muted">
                              <i className="bi bi-check-square me-1"></i>
                              Task linked
                            </div>
                          )}
                        </td>

                        {/* Hours */}
                        <td>
                          <Badge bg="primary" className="fs-6">
                            {formatHours(entry.hours)}
                          </Badge>
                        </td>

                        {/* Billable */}
                        <td>
                          {entry.billable ? (
                            <Badge bg="success">Yes</Badge>
                          ) : (
                            <Badge bg="secondary">No</Badge>
                          )}
                        </td>

                        {/* Notes */}
                        <td>
                          <small className="text-muted">
                            {entry.notes || '-'}
                          </small>
                        </td>

                        {/* Actions */}
                        {canEdit && (
                          <td className="text-center">
                            <div className="d-flex gap-1 justify-content-center">
                              <Button
                                size="sm"
                                variant="outline-primary"
                                onClick={() => onEditEntry(entry)}
                                title="Edit entry"
                              >
                                <i className="bi bi-pencil"></i>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline-danger"
                                onClick={() => onDeleteEntry(entry)}
                                title="Delete entry"
                              >
                                <i className="bi bi-trash"></i>
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </Table>
        </div>
      </Card.Body>
    </Card>
  );
}
