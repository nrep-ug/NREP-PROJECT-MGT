'use client';

import { useMemo, useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import ApproverPicker from './ApproverPicker';
import { formatCurrency } from '@/lib/financeFormat';

function dateInputValue(value, fallback = '') {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString().slice(0, 10);
}

function datePayload(value) {
  return new Date(`${value}T12:00:00.000Z`).toISOString();
}

export default function CommitmentForm({
  project,
  budgetLines = [],
  initialValue = null,
  onSubmit,
  onCancel,
  submitting = false,
  approvers = [],
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    budgetLineId: initialValue?.budgetLineId || '',
    amount: initialValue?.amount || '',
    commitmentDate: dateInputValue(initialValue?.commitmentDate, today),
    expectedDate: dateInputValue(initialValue?.expectedDate),
    vendor: initialValue?.vendor || '',
    referenceNumber: initialValue?.referenceNumber || '',
    description: initialValue?.description || '',
  });
  const [error, setError] = useState('');
  const [assignedReviewerId, setAssignedReviewerId] = useState(initialValue?.assignedReviewerId || '');

  const approvedLines = useMemo(
    () => budgetLines.filter((line) => line.status === 'approved'),
    [budgetLines]
  );

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const save = (submit) => {
    if (!project?.$id) return setError('Choose a project before recording a commitment.');
    if (!form.budgetLineId) return setError('Select an approved activity budget.');
    if (!form.amount || !Number.isFinite(Number(form.amount)) || Number(form.amount) <= 0) {
      return setError('Enter a commitment amount greater than zero.');
    }
    if (!form.commitmentDate) return setError('Enter the commitment date.');
    if (!form.expectedDate) return setError('Enter the expected settlement date.');
    if (form.expectedDate < form.commitmentDate) {
      return setError('The expected settlement date cannot be before the commitment date.');
    }
    if (!form.vendor.trim()) return setError('Enter the vendor or payee.');
    if (!form.description.trim()) return setError('Describe the financial obligation.');

    setError('');
    onSubmit?.({
      projectId: project.$id,
      budgetLineId: form.budgetLineId,
      amount: form.amount,
      commitmentDate: datePayload(form.commitmentDate),
      expectedDate: datePayload(form.expectedDate),
      vendor: form.vendor.trim(),
      referenceNumber: form.referenceNumber.trim() || null,
      description: form.description.trim(),
      submit,
      assignedReviewerId: submit ? assignedReviewerId : undefined,
    });
  };

  const submitForReview = (event) => {
    event.preventDefault();
    save(true);
  };

  if (approvedLines.length === 0) {
    return <Alert variant="warning">This project has no approved activity budget for a commitment.</Alert>;
  }

  return (
    <Form onSubmit={submitForReview}>
      {error && <Alert variant="danger">{error}</Alert>}
      <Alert variant="info" className="small">
        A commitment reserves available funds but does not become Actual Spend until it is linked to an approved expense.
      </Alert>

      <Form.Group className="mb-3" controlId="commitment-project">
        <Form.Label>Project</Form.Label>
        <Form.Control value={`${project?.code || ''} - ${project?.name || ''}`} readOnly />
      </Form.Group>

      <Form.Group className="mb-3" controlId="commitment-budget-line">
        <Form.Label>Activity budget *</Form.Label>
        <Form.Select value={form.budgetLineId} onChange={(event) => update('budgetLineId', event.target.value)} required>
          <option value="">Choose an approved activity</option>
          {approvedLines.map((line) => {
            const available = line.uncommittedBalance ?? line.availableBalance ?? line.revisedBudget ?? line.originalAmount;
            return (
              <option key={line.$id} value={line.$id}>
                {line.activityCode ? `${line.activityCode} - ` : ''}{line.activityName} ({formatCurrency(available, line.currency || project?.budgetCurrency)} available)
              </option>
            );
          })}
        </Form.Select>
      </Form.Group>

      <div className="row g-3 mb-3">
        <div className="col-md-4">
          <Form.Group controlId="commitment-amount">
            <Form.Label>Amount ({project?.budgetCurrency}) *</Form.Label>
            <Form.Control type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => update('amount', event.target.value)} required />
          </Form.Group>
        </div>
        <div className="col-md-4">
          <Form.Group controlId="commitment-date">
            <Form.Label>Commitment date *</Form.Label>
            <Form.Control type="date" value={form.commitmentDate} onChange={(event) => update('commitmentDate', event.target.value)} required />
          </Form.Group>
        </div>
        <div className="col-md-4">
          <Form.Group controlId="commitment-expected-date">
            <Form.Label>Expected settlement date *</Form.Label>
            <Form.Control type="date" min={form.commitmentDate || undefined} value={form.expectedDate} onChange={(event) => update('expectedDate', event.target.value)} required />
          </Form.Group>
        </div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-md-7">
          <Form.Group controlId="commitment-vendor">
            <Form.Label>Vendor / payee *</Form.Label>
            <Form.Control maxLength={190} value={form.vendor} onChange={(event) => update('vendor', event.target.value)} required />
          </Form.Group>
        </div>
        <div className="col-md-5">
          <Form.Group controlId="commitment-reference">
            <Form.Label>Purchase order / reference</Form.Label>
            <Form.Control maxLength={120} value={form.referenceNumber} onChange={(event) => update('referenceNumber', event.target.value)} />
          </Form.Group>
        </div>
      </div>

      <Form.Group className="mb-4" controlId="commitment-description">
        <Form.Label>Description *</Form.Label>
        <Form.Control as="textarea" rows={4} maxLength={2000} value={form.description} onChange={(event) => update('description', event.target.value)} required />
      </Form.Group>

      <ApproverPicker approvers={approvers} kind="commitment" value={assignedReviewerId} onChange={setAssignedReviewerId} />
      <div className="d-flex flex-wrap justify-content-end gap-2">
        {onCancel && <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>Cancel</Button>}
        <Button type="button" variant="secondary" onClick={() => save(false)} disabled={submitting}>
          {submitting ? <Spinner size="sm" animation="border" /> : 'Save draft'}
        </Button>
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? <Spinner size="sm" animation="border" /> : 'Submit commitment for review'}
        </Button>
      </div>
    </Form>
  );
}
