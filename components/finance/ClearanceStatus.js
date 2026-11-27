'use client';

import { useState } from 'react';
import { Alert, Button, Modal, Spinner } from 'react-bootstrap';
import { authenticatedFetch } from '@/lib/apiClient';
import ApproverPicker, { approverName, eligibleApprovers } from './ApproverPicker';

/**
 * Who a submitted Finance record is waiting on, shown under its status badge.
 * The preparer (or a Finance administrator) can send it to a different
 * approver while it is waiting. Renders nothing unless the record is submitted.
 */
export default function ClearanceStatus({ record, kind, finance, onChanged, notify }) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (record.status !== 'submitted') return null;

  const actor = finance?.actor || {};
  const approvers = finance?.approvers || [];
  const assigned = record.assignedReviewerId;
  const label = !assigned
    ? 'Any approver can clear'
    : assigned === actor.accountId
      ? 'Waiting for you'
      : `Waiting for ${approverName(approvers, assigned) || 'the chosen approver'}`;
  const others = eligibleApprovers(approvers, kind, record.createdBy).filter((p) => p.accountId !== assigned);
  const canReassign = (record.createdBy === actor.accountId || actor.canAdministerFinance) && others.length > 0;
  // Finance administrator (e.g. the director) taking over a record someone else is holding.
  const canTakeOver = actor.canAdministerFinance && assigned !== actor.accountId && record.createdBy !== actor.accountId
    && others.some((p) => p.accountId === actor.accountId);

  const send = async (target = choice) => {
    setBusy(true);
    setError('');
    try {
      const response = await authenticatedFetch('/api/finance/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, id: record.$id, assignedReviewerId: target }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not send it to that person.');
      notify?.(target === actor.accountId ? 'It is now yours to clear.' : `Sent to ${approverName(approvers, target)} for clearance.`, 'success');
      setOpen(false);
      onChanged?.(data.record);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="small mt-1">
      <span className={assigned === actor.accountId ? 'fw-semibold text-success' : 'text-muted'}>
        <i className="bi bi-person-check me-1" aria-hidden="true" />{label}
      </span>
      {canTakeOver && (
        <Button variant="link" size="sm" className="p-0 ms-2 align-baseline" disabled={busy} onClick={() => send(actor.accountId)}>
          Take over
        </Button>
      )}
      {error && !open && <div className="text-danger">{error}</div>}
      {canReassign && (
        <Button
          variant="link"
          size="sm"
          className="p-0 ms-2 align-baseline"
          onClick={() => { setChoice(''); setError(''); setOpen(true); }}
        >
          Send to someone else
        </Button>
      )}
      <Modal show={open} onHide={() => setOpen(false)} centered>
        <Modal.Header closeButton><Modal.Title as="h2" className="h5">Send to someone else</Modal.Title></Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          <p className="small text-muted">
            {assigned ? `It is currently waiting for ${approverName(approvers, assigned) || 'another approver'}.` : 'Nobody has been chosen yet.'}
            {' '}The person you choose will be the only one who can clear it.
          </p>
          <ApproverPicker
            approvers={approvers.filter((p) => p.accountId !== assigned)}
            kind={kind}
            value={choice}
            onChange={setChoice}
            excludeAccountId={record.createdBy}
            id={`reassign-${record.$id}`}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button variant="primary" onClick={() => send()} disabled={!choice || busy}>{busy ? <Spinner size="sm" animation="border" /> : 'Send'}</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
