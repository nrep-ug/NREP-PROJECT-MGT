'use client';

import { useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import ApproverPicker from './ApproverPicker';

export default function BudgetLineForm({ project, activities = [], initialValue = null, onSubmit, submitting, onCancel, approvers = [] }) {
  const [form, setForm] = useState({
    activityId: initialValue?.activityId || '',
    originalAmount: initialValue?.originalAmount || '',
    notes: initialValue?.notes || '',
  });
  const [error, setError] = useState('');
  const [assignedReviewerId, setAssignedReviewerId] = useState(initialValue?.assignedReviewerId || '');

  const submit = (event) => {
    event.preventDefault();
    if (!form.originalAmount || Number(form.originalAmount) <= 0) {
      setError('Enter an original approved budget greater than zero.');
      return;
    }
    setError('');
    onSubmit({
      projectId: project.$id,
      activityId: form.activityId || null,
      originalAmount: form.originalAmount,
      notes: form.notes,
      submit: true,
      assignedReviewerId,
    });
  };

  return (
    <Form onSubmit={submit}>
      {error && <Alert variant="danger">{error}</Alert>}
      <Alert variant="info" className="small">
        Original budgets are locked after approval. Future changes are recorded as reallocations, so the audit trail stays intact.
      </Alert>
      <Form.Group className="mb-3">
        <Form.Label>Project</Form.Label>
        <Form.Control value={`${project.code} · ${project.name}`} readOnly />
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label>Activity</Form.Label>
        <Form.Select value={form.activityId} onChange={(event) => setForm({ ...form, activityId: event.target.value })}>
          <option value="">General / Contingency</option>
          {activities.map((activity) => (
            <option key={activity.$id} value={activity.$id}>
              {activity.activityCode ? `${activity.activityCode} · ` : ''}{activity.name}
            </option>
          ))}
        </Form.Select>
        <Form.Text>Activities without a code remain valid and are linked by their stable ID.</Form.Text>
      </Form.Group>
      <div className="row g-3 mb-3">
        <div className="col-md-8">
          <Form.Group>
            <Form.Label>Original approved budget *</Form.Label>
            <Form.Control
              type="number"
              min="0.01"
              step="0.01"
              value={form.originalAmount}
              onChange={(event) => setForm({ ...form, originalAmount: event.target.value })}
              required
            />
          </Form.Group>
        </div>
        <div className="col-md-4">
          <Form.Group>
            <Form.Label>Currency</Form.Label>
            <Form.Control value={project.budgetCurrency} readOnly />
          </Form.Group>
        </div>
      </div>
      <Form.Group className="mb-4">
        <Form.Label>Budget note</Form.Label>
        <Form.Control
          as="textarea"
          rows={3}
          maxLength={1000}
          value={form.notes}
          onChange={(event) => setForm({ ...form, notes: event.target.value })}
          placeholder="Approval reference, funding restriction, or context"
        />
      </Form.Group>
      <ApproverPicker approvers={approvers} kind="budgetLine" value={assignedReviewerId} onChange={setAssignedReviewerId} />
      <div className="d-flex justify-content-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? <Spinner size="sm" animation="border" /> : 'Submit budget for review'}
        </Button>
      </div>
    </Form>
  );
}
