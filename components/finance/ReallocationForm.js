'use client';

import { useMemo, useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import ApproverPicker from './ApproverPicker';
import { formatCurrency } from '@/lib/financeFormat';

export default function ReallocationForm({ project, budgetLines = [], initialValue = null, onSubmit, submitting, onCancel, approvers = [] }) {
  const [form, setForm] = useState({
    fromBudgetLineId: initialValue?.fromBudgetLineId || '',
    toBudgetLineId: initialValue?.toBudgetLineId || '',
    amount: initialValue?.amount || '',
    reason: initialValue?.reason || '',
  });
  const [error, setError] = useState('');
  const [assignedReviewerId, setAssignedReviewerId] = useState(initialValue?.assignedReviewerId || '');
  const lines = useMemo(() => budgetLines.filter((line) => line.status === 'approved'), [budgetLines]);

  const submit = (event) => {
    event.preventDefault();
    if (!form.fromBudgetLineId || !form.toBudgetLineId) return setError('Choose source and destination activity budgets.');
    if (form.fromBudgetLineId === form.toBudgetLineId) return setError('Source and destination must be different.');
    if (!form.amount || Number(form.amount) <= 0) return setError('Enter an amount greater than zero.');
    const source = lines.find((line) => line.$id === form.fromBudgetLineId);
    if (Number(form.amount) > Number(source?.availableBalance || 0)) return setError('The amount exceeds the source activity’s current available balance.');
    if (!form.reason.trim()) return setError('Explain why the reallocation is required.');
    setError('');
    onSubmit({ projectId: project.$id, ...form, submit: true, assignedReviewerId });
  };

  if (lines.length < 2) return <Alert variant="warning">At least two approved activity budgets are required.</Alert>;

  return (
    <Form onSubmit={submit}>
      {error && <Alert variant="danger">{error}</Alert>}
      <Alert variant="info" className="small">Approval creates a transfer record. Original approved budgets are never overwritten.</Alert>
      <div className="row g-3 mb-3">
        <div className="col-md-6">
          <Form.Label>Move funds from *</Form.Label>
          <Form.Select value={form.fromBudgetLineId} onChange={(event) => setForm({ ...form, fromBudgetLineId: event.target.value })} required>
            <option value="">Choose source</option>
            {lines.map((line) => <option key={line.$id} value={line.$id}>{line.activityCode ? `${line.activityCode} · ` : ''}{line.activityName} — {formatCurrency(line.availableBalance, line.currency)} available</option>)}
          </Form.Select>
        </div>
        <div className="col-md-6">
          <Form.Label>Move funds to *</Form.Label>
          <Form.Select value={form.toBudgetLineId} onChange={(event) => setForm({ ...form, toBudgetLineId: event.target.value })} required>
            <option value="">Choose destination</option>
            {lines.map((line) => <option key={line.$id} value={line.$id}>{line.activityCode ? `${line.activityCode} · ` : ''}{line.activityName}</option>)}
          </Form.Select>
        </div>
      </div>
      <Form.Group className="mb-3">
        <Form.Label>Amount ({project.budgetCurrency}) *</Form.Label>
        <Form.Control type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} required />
      </Form.Group>
      <Form.Group className="mb-4">
        <Form.Label>Reason *</Form.Label>
        <Form.Control as="textarea" rows={4} maxLength={2000} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} required />
      </Form.Group>
      <ApproverPicker approvers={approvers} kind="reallocation" value={assignedReviewerId} onChange={setAssignedReviewerId} />
      <div className="d-flex justify-content-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={submitting}>{submitting ? <Spinner size="sm" animation="border" /> : 'Submit reallocation'}</Button>
      </div>
    </Form>
  );
}
