'use client';

import { Modal, Button, ListGroup, Badge } from 'react-bootstrap';
import { formatDate, formatHours } from '@/lib/date';

/**
 * Day Entries Modal Component
 * Shows all entries for a specific day/project and allows editing or adding new
 */
export default function DayEntriesModal({
  show,
  onHide,
  date,
  project,
  entries,
  canEdit,
  onEditEntry,
  onAddEntry
}) {
  if (!date || !project) return null;

  const dateStr = formatDate(date, 'YYYY-MM-DD');
  const dayEntries = entries.filter(e =>
    formatDate(e.workDate, 'YYYY-MM-DD') === dateStr && e.projectId === project.$id
  );

  return (
    <Modal show={show} onHide={onHide} centered size="lg">
      <Modal.Header closeButton>
        <Modal.Title>
          {formatDate(date, 'dddd, MMM DD, YYYY')}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="mb-3">
          <h6 className="text-muted mb-2">Project</h6>
          <div>
            <strong>{project.name}</strong>
            {project.code && (
              <Badge bg="secondary" className="ms-2">
                {project.code}
              </Badge>
            )}
          </div>
        </div>

        {dayEntries.length === 0 ? (
          <div className="text-center py-4 bg-light rounded">
            <i className="bi bi-inbox" style={{ fontSize: '3rem', opacity: 0.3 }}></i>
            <p className="text-muted mt-2 mb-0">
              No time entries for this day
            </p>
          </div>
        ) : (
          <>
            <h6 className="text-muted mb-2">Time Entries ({dayEntries.length})</h6>
            <ListGroup>
              {dayEntries.map((entry) => (
                <ListGroup.Item key={entry.$id} className="d-flex justify-content-between align-items-start">
                  <div className="flex-grow-1">
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <Badge bg="primary" className="fs-6">
                        {formatHours(entry.hours)}
                      </Badge>
                      {entry.billable ? (
                        <Badge bg="success">Billable</Badge>
                      ) : (
                        <Badge bg="secondary">Non-Billable</Badge>
                      )}
                      {entry.taskId && (
                        <Badge bg="info">
                          <i className="bi bi-check-square me-1"></i>
                          Task linked
                        </Badge>
                      )}
                    </div>
                    {entry.notes && (
                      <div className="small text-muted mt-2">
                        <i className="bi bi-sticky me-1"></i>
                        {entry.notes}
                      </div>
                    )}
                  </div>
                  {canEdit && (
                    <Button
                      size="sm"
                      variant="outline-primary"
                      onClick={() => {
                        onEditEntry(entry);
                        onHide();
                      }}
                    >
                      <i className="bi bi-pencil me-1"></i>
                      Edit
                    </Button>
                  )}
                </ListGroup.Item>
              ))}
            </ListGroup>

            {dayEntries.length > 0 && (
              <div className="mt-3 p-2 bg-light rounded">
                <div className="d-flex justify-content-between align-items-center">
                  <span className="text-muted">Total for this project:</span>
                  <Badge bg="dark" className="fs-6">
                    {formatHours(dayEntries.reduce((sum, e) => sum + e.hours, 0))}
                  </Badge>
                </div>
              </div>
            )}
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        {canEdit && (
          <Button
            variant="primary"
            onClick={() => {
              onAddEntry(date, project.$id);
              onHide();
            }}
          >
            <i className="bi bi-plus-circle me-2"></i>
            Add New Entry
          </Button>
        )}
        <Button variant="secondary" onClick={onHide}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
