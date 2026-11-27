'use client';

import { Form } from 'react-bootstrap';

/** People who can clear this kind of record (budgets need a Budget Approver). */
export function eligibleApprovers(approvers = [], kind, excludeAccountId) {
  return approvers.filter((person) => (
    person.accountId !== excludeAccountId &&
    (kind === 'budgetLine' ? person.canApproveBudgets : person.canReviewRecords)
  ));
}

export function approverName(approvers = [], accountId) {
  return approvers.find((person) => person.accountId === accountId)?.name || null;
}

/**
 * "Send to … for clearance" choice shown when submitting a Finance record.
 * Renders nothing when the organization has no named approvers configured,
 * so submission still works (any approver may then clear it).
 */
export default function ApproverPicker({ approvers, kind, value, onChange, excludeAccountId, id = 'assigned-approver' }) {
  const options = eligibleApprovers(approvers, kind, excludeAccountId);
  if (options.length === 0) return null;
  return (
    <Form.Group className="mb-3">
      <Form.Label htmlFor={id} className="fw-semibold">Send to for clearance</Form.Label>
      <Form.Select id={id} value={value || ''} onChange={(event) => onChange(event.target.value)} required>
        <option value="" disabled>Choose who will clear this…</option>
        {options.map((person) => (
          <option key={person.accountId} value={person.accountId}>
            {person.name}{person.title ? ` · ${person.title}` : ''}
          </option>
        ))}
      </Form.Select>
      <Form.Text>Only the person you choose can approve it. You can send it to someone else while it is waiting.</Form.Text>
    </Form.Group>
  );
}
