'use client';

import { useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import AuditTimeline from '@/components/finance/AuditTimeline';
import StatusBadge from '@/components/ui/StatusBadge';
import { formatCurrency } from '@/lib/financeFormat';

const STEPS = [
  { key: 'draft', label: 'Draft' },
  { key: 'validation', label: 'Finance Validation' },
  { key: 'approval', label: 'Approval' },
  { key: 'active', label: 'Active' },
];

function currentStepIndex(line) {
  if (line.status === 'approved') return 3;
  if (line.status === 'submitted' && line.validationStatus === 'validated') return 2;
  if (line.status === 'submitted') return 1;
  return 0; // draft or returned
}

/**
 * One shared "Activity Budget Proposal" view — used by the Project Head who
 * drafted it, the Finance Officer who validates it, and the Budget Approver
 * who approves it. Same lifecycle, same component, no duplicated logic; only
 * which action buttons render changes, based on the actor's real capability.
 */
export default function BudgetProposalDetail({ line, actor, onValidate, onApprove, submitting, readOnlyReason }) {
  const [comment, setComment] = useState('');
  const step = currentStepIndex(line);
  const isOwn = line.createdBy === actor?.accountId;

  const canValidate = Boolean(onValidate) && actor?.canValidateBudgets && line.status === 'submitted' && line.validationStatus !== 'validated' && !isOwn;
  const canApprove = Boolean(onApprove) && actor?.canApproveBudgets && line.status === 'submitted' && line.validationStatus === 'validated'
    && line.createdBy !== actor?.accountId && line.validatedBy !== actor?.accountId;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
        <div>
          <div className="text-muted small">{line.activityCode || 'Uncoded activity'}</div>
          <h5 className="mb-0">{line.activityName}</h5>
        </div>
        <StatusBadge status={line.status} />
      </div>

      {/* Compact step indicator — Draft → Finance Validation → Approval → Active */}
      <div className="d-flex align-items-center mb-4" aria-label="Budget proposal progress">
        {STEPS.map((s, index) => (
          <div key={s.key} className="d-flex align-items-center flex-grow-1">
            <div className="d-flex flex-column align-items-center" style={{ minWidth: 88 }}>
              <span
                className="d-inline-flex align-items-center justify-content-center rounded-circle"
                style={{
                  width: 28, height: 28, fontSize: '0.8rem', fontWeight: 700,
                  color: index <= step ? '#fff' : 'var(--nrep-muted)',
                  background: index <= step ? 'var(--nrep-deep-blue)' : 'var(--nrep-disabled-bg)',
                }}
              >
                {index < step ? <i className="bi bi-check-lg" /> : index + 1}
              </span>
              <small className="mt-1 text-center" style={{ fontSize: '0.7rem', color: index <= step ? 'var(--nrep-text)' : 'var(--nrep-muted)', fontWeight: index === step ? 700 : 500 }}>{s.label}</small>
            </div>
            {index < STEPS.length - 1 && <div style={{ flex: 1, height: 2, background: index < step ? 'var(--nrep-deep-blue)' : 'var(--nrep-border)' }} />}
          </div>
        ))}
      </div>

      {line.status === 'returned' && (
        <Alert variant="warning">
          <strong>Returned</strong>
          {line.reviewerComment && <div className="mt-1">{line.reviewerComment}</div>}
        </Alert>
      )}
      {line.status === 'rejected' && (
        <Alert variant="danger"><strong>Rejected</strong>{line.reviewerComment && <div className="mt-1">{line.reviewerComment}</div>}</Alert>
      )}
      {line.status === 'submitted' && line.validationStatus !== 'validated' && (
        <Alert variant="info">Submitted to Finance — waiting for validation.</Alert>
      )}
      {line.status === 'submitted' && line.validationStatus === 'validated' && (
        <Alert variant="info">Financially validated — waiting for approval.</Alert>
      )}

      <div className="row g-3 mb-3">
        <div className="col-sm-6"><small className="text-muted d-block">Proposed budget</small><strong>{formatCurrency(line.originalAmount, line.currency)}</strong></div>
        <div className="col-sm-6"><small className="text-muted d-block">Prepared by</small><strong>{line.createdByName || '—'}</strong></div>
        {line.validatedByName && <div className="col-sm-6"><small className="text-muted d-block">Validated by</small><strong>{line.validatedByName}</strong></div>}
        {line.reviewedByName && line.status === 'approved' && <div className="col-sm-6"><small className="text-muted d-block">Approved by</small><strong>{line.reviewedByName}</strong></div>}
      </div>
      {line.proposalJustification && (
        <Alert variant="light" className="border"><strong>Justification:</strong> {line.proposalJustification}</Alert>
      )}

      <AuditTimeline record={line} title="Audit history" />

      {readOnlyReason && <p className="text-muted small mt-3 mb-0">{readOnlyReason}</p>}

      {(canValidate || canApprove) && (
        <div className="border-top mt-4 pt-4">
          <Form.Group className="mb-3">
            <Form.Label>{canApprove ? 'Approver comment' : 'Validation comment'}</Form.Label>
            <Form.Control as="textarea" rows={3} maxLength={1000} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Required for return or rejection" />
          </Form.Group>
          <div className="d-flex flex-wrap justify-content-end gap-2">
            <Button variant="secondary" disabled={submitting} onClick={() => (canApprove ? onApprove('return', comment) : onValidate('return', comment))}>Return for correction</Button>
            <Button variant="outline-danger" disabled={submitting} onClick={() => (canApprove ? onApprove('reject', comment) : onValidate('reject', comment))}>Reject</Button>
            <Button variant="success" disabled={submitting} onClick={() => (canApprove ? onApprove('approve', comment) : onValidate('validate', comment))}>
              {submitting ? <Spinner size="sm" animation="border" /> : canApprove ? 'Approve' : 'Validate'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
