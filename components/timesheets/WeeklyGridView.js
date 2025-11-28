'use client';

import { Card, Table, Badge, Button } from 'react-bootstrap';
import { formatDate, formatHours, addDays } from '@/lib/date';

/**
 * Weekly Grid View for Timesheets
 * Traditional calendar view with Mon-Sun columns and projects as rows
 */
export default function WeeklyGridView({
  entries,
  projects,
  weekStart,
  canEdit,
  onCellClick
}) {
  // Generate week days (Mon-Sun)
  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(new Date(weekStart), i);
    weekDays.push(date);
  }

  // Group entries by project and date
  const entriesByProjectAndDate = {};
  entries.forEach(entry => {
    // Normalize date to YYYY-MM-DD format for consistent comparison
    const normalizedDate = formatDate(entry.workDate, 'YYYY-MM-DD');

    if (!entriesByProjectAndDate[entry.projectId]) {
      entriesByProjectAndDate[entry.projectId] = {};
    }
    if (!entriesByProjectAndDate[entry.projectId][normalizedDate]) {
      entriesByProjectAndDate[entry.projectId][normalizedDate] = [];
    }
    entriesByProjectAndDate[entry.projectId][normalizedDate].push(entry);
  });

  // Calculate daily totals
  const dailyTotals = {};
  weekDays.forEach(day => {
    const dateStr = formatDate(day, 'YYYY-MM-DD');
    const dayEntries = entries.filter(e => formatDate(e.workDate, 'YYYY-MM-DD') === dateStr);
    dailyTotals[dateStr] = dayEntries.reduce((sum, e) => sum + e.hours, 0);
  });

  // Get projects that have entries
  const projectsWithEntries = projects.filter(p =>
    entries.some(e => e.projectId === p.$id)
  );

  // Add projects without entries if user can edit
  const allProjects = canEdit ? projects : projectsWithEntries;

  return (
    <Card className="border-0 shadow-sm">
      <Card.Header className="bg-white">
        <h5 className="mb-0">Weekly Calendar View</h5>
      </Card.Header>
      <Card.Body className="p-0">
        <div className="table-responsive">
          <Table className="mb-0 timesheet-grid" bordered>
            <thead className="table-light">
              <tr>
                <th style={{ minWidth: '150px' }}>Project</th>
                {weekDays.map((day, idx) => {
                  const dateStr = formatDate(day, 'YYYY-MM-DD');
                  const isToday = formatDate(new Date(), 'YYYY-MM-DD') === dateStr;
                  return (
                    <th
                      key={idx}
                      className={`text-center ${isToday ? 'bg-primary bg-opacity-10' : ''}`}
                      style={{ minWidth: '100px' }}
                    >
                      <div className="fw-bold">
                        {day.toLocaleDateString('en-US', { weekday: 'short' })}
                      </div>
                      <div className="small text-muted">
                        {day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </th>
                  );
                })}
                <th className="text-center" style={{ minWidth: '80px' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {allProjects.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-4 text-muted">
                    No projects with time entries yet. Add an entry to get started.
                  </td>
                </tr>
              ) : (
                <>
                  {allProjects.map((project) => {
                    const projectEntries = entriesByProjectAndDate[project.$id] || {};
                    const projectTotal = entries
                      .filter(e => e.projectId === project.$id)
                      .reduce((sum, e) => sum + e.hours, 0);

                    return (
                      <tr key={project.$id}>
                        <td className="align-middle">
                          <div className="fw-bold">{project.name}</div>
                          {project.code && (
                            <Badge bg="secondary" className="small">{project.code}</Badge>
                          )}
                        </td>
                        {weekDays.map((day, idx) => {
                          const dateStr = formatDate(day, 'YYYY-MM-DD');
                          const dayEntries = projectEntries[dateStr] || [];
                          const dayTotal = dayEntries.reduce((sum, e) => sum + e.hours, 0);
                          const isToday = formatDate(new Date(), 'YYYY-MM-DD') === dateStr;

                          return (
                            <td
                              key={idx}
                              className={`text-center align-middle p-2 ${isToday ? 'bg-primary bg-opacity-10' : ''}`}
                              style={{ cursor: canEdit ? 'pointer' : 'default' }}
                              onClick={() => {
                                if (canEdit && onCellClick) {
                                  onCellClick(day, project);
                                }
                              }}
                              title={dayEntries.length > 0 ? dayEntries.map(e => e.notes).filter(Boolean).join(' | ') : 'Click to add or view entries'}
                            >
                              {dayTotal > 0 ? (
                                <div>
                                  <Badge bg="primary" className="fs-6">
                                    {formatHours(dayTotal)}
                                  </Badge>
                                  {dayEntries.length > 1 && (
                                    <div className="small text-muted mt-1">
                                      {dayEntries.length} entries
                                    </div>
                                  )}
                                  {dayEntries.some(e => e.taskId) && (
                                    <div className="small text-muted">
                                      <i className="bi bi-check-square"></i>
                                    </div>
                                  )}
                                  {dayEntries[0].notes && (
                                    <div className="small text-muted mt-1" style={{ fontSize: '0.7rem', lineHeight: '1' }}>
                                      {dayEntries[0].notes.length > 20 ? dayEntries[0].notes.substring(0, 20) + '...' : dayEntries[0].notes}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-muted small" style={{ fontSize: '0.75rem' }}>
                                  {canEdit ? (
                                    <>
                                      <i className="bi bi-plus-circle d-block mb-1"></i>
                                      <span>Add</span>
                                    </>
                                  ) : (
                                    <span>-</span>
                                  )}
                                </div>
                              )}
                            </td>
                          );
                        })}
                        <td className="text-center align-middle bg-light">
                          <strong>{formatHours(projectTotal)}</strong>
                        </td>
                      </tr>
                    );
                  })}
                  {/* Daily Totals Row */}
                  <tr className="table-secondary fw-bold">
                    <td>Daily Total</td>
                    {weekDays.map((day, idx) => {
                      const dateStr = formatDate(day, 'YYYY-MM-DD');
                      const total = dailyTotals[dateStr] || 0;
                      const isToday = formatDate(new Date(), 'YYYY-MM-DD') === dateStr;
                      const isOverLimit = total > 24;

                      return (
                        <td
                          key={idx}
                          className={`text-center ${isToday ? 'bg-primary bg-opacity-25' : ''}`}
                        >
                          <Badge bg={isOverLimit ? 'danger' : 'dark'} className="fs-6">
                            {formatHours(total)}
                          </Badge>
                          {isOverLimit && (
                            <div className="small text-danger mt-1">
                              Exceeds 24h!
                            </div>
                          )}
                        </td>
                      );
                    })}
                    <td className="text-center bg-dark text-white">
                      <strong>{formatHours(entries.reduce((sum, e) => sum + e.hours, 0))}</strong>
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </Table>
        </div>

        {canEdit && (
          <div className="p-3 bg-light border-top">
            <small className="text-muted">
              <i className="bi bi-info-circle me-1"></i>
              Click on any cell to add or edit time entries
            </small>
          </div>
        )}
      </Card.Body>
    </Card>
  );
}
