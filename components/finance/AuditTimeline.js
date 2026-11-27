'use client';

import { Alert } from 'react-bootstrap';
import { titleCase } from '@/lib/financeFormat';

const ACTION_DETAILS = Object.freeze({
  created: { label: 'Created', icon: 'bi-plus-circle', tone: 'text-primary' },
  submitted: { label: 'Submitted', icon: 'bi-send', tone: 'text-warning' },
  returned: { label: 'Returned', icon: 'bi-arrow-return-left', tone: 'text-info' },
  edited: { label: 'Edited', icon: 'bi-pencil', tone: 'text-secondary' },
  resubmitted: { label: 'Resubmitted', icon: 'bi-arrow-repeat', tone: 'text-warning' },
  validated: { label: 'Validated', icon: 'bi-shield-check', tone: 'text-primary' },
  approved: { label: 'Approved', icon: 'bi-check2-circle', tone: 'text-success' },
  rejected: { label: 'Rejected', icon: 'bi-x-circle', tone: 'text-danger' },
  rejectd: { label: 'Rejected', icon: 'bi-x-circle', tone: 'text-danger' },
});

function parseHistory(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeAction(value) {
  return String(value || 'event').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function eventTimestamp(event) {
  const value = event.at || event.timestamp || event.createdAt || event.$createdAt;
  if (!value) return { value: null, time: null };
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? { value: null, time: null }
    : { value: date.toISOString(), time: date.getTime() };
}

function formatTimestamp(value) {
  if (!value) return 'Time unavailable';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function normalizeAuditHistory(record) {
  return parseHistory(record?.workflowHistory)
    .filter((event) => event && typeof event === 'object' && !Array.isArray(event))
    .map((event, sourceIndex) => {
      const action = normalizeAction(event.action || event.type);
      const timestamp = eventTimestamp(event);
      return {
        ...event,
        action,
        actor: String(
          event.actorName ||
          (typeof event.actor === 'object' ? event.actor?.name || event.actor?.$id : event.actor) ||
          event.performedByName ||
          event.createdByName ||
          event.actorId ||
          'System'
        ),
        comment: String(event.comment || event.reason || event.reviewerComment || '').trim(),
        timestamp: timestamp.value,
        timestampValue: timestamp.time,
        sourceIndex,
      };
    })
    .sort((left, right) => {
      if (left.timestampValue !== null && right.timestampValue !== null) {
        return left.timestampValue - right.timestampValue || left.sourceIndex - right.sourceIndex;
      }
      if (left.timestampValue !== null) return -1;
      if (right.timestampValue !== null) return 1;
      return left.sourceIndex - right.sourceIndex;
    });
}

export default function AuditTimeline({
  record,
  title = 'Audit timeline',
  emptyText = 'No audit history is available for this record yet.',
}) {
  const events = normalizeAuditHistory(record);

  return (
    <section aria-label={title}>
      {title && <h6 className="fw-bold mb-3">{title}</h6>}
      {events.length === 0 ? (
        <Alert variant="light" className="border mb-0 small text-muted">
          <i className="bi bi-clock-history me-2" aria-hidden="true" />
          {emptyText}
        </Alert>
      ) : (
        <ol className="list-unstyled mb-0" aria-label={`${title || 'Audit timeline'} events`}>
          {events.map((event) => {
            const details = ACTION_DETAILS[event.action] || {
              label: titleCase(event.action),
              icon: 'bi-circle',
              tone: 'text-secondary',
            };
            return (
              <li
                key={event.$id || event.id || `${event.action}-${event.timestamp || 'undated'}-${event.sourceIndex}`}
                className="d-flex gap-3 pb-3 mb-3 border-bottom"
              >
                <span className={`${details.tone} fs-5 lh-1`} aria-hidden="true">
                  <i className={`bi ${details.icon}`} />
                </span>
                <div className="min-w-0 flex-grow-1">
                  <div className="d-flex flex-wrap justify-content-between gap-2">
                    <strong>{details.label}</strong>
                    {event.timestamp ? (
                      <time className="small text-muted" dateTime={event.timestamp}>
                        {formatTimestamp(event.timestamp)}
                      </time>
                    ) : (
                      <span className="small text-muted">Time unavailable</span>
                    )}
                  </div>
                  <div className="small text-muted mt-1">By {event.actor}</div>
                  {event.comment && <p className="small mb-0 mt-2 text-break">{event.comment}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
