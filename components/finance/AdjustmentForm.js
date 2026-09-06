'use client';

import { useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';

export default function AdjustmentForm({ expense, onSubmit, onCancel, submitting }) {
  const [form, setForm] = useState({ adjustmentType: 'decrease', amount: '', reason: '', effectiveDate: new Date().toISOString().slice(0, 10) });
  const [error, setError] = useState('');
  const submit = (event) => {
    event.preventDefault();
    if (form.adjustmentType !== 'reversal' && (!form.amount || Number(form.amount) <= 0)) return setError('Enter an adjustment amount greater than zero.');
    if (!form.reason.trim()) return setError('An audit reason is required.');
    setError('');
    onSubmit({
      originalExpenseId: expense.$id,
      ...form,
      amount: form.adjustmentType === 'reversal' ? expense.amount : form.amount,
      effectiveDate: new Date(`${form.effectiveDate}T12:00:00.000Z`).toISOString(),
      submit: true,
    });
  };
  return (
    <Form onSubmit={submit}>
      {error && <Alert variant="danger">{error}</Alert>}
      <Alert variant="warning" className="small">The approved expense stays unchanged. This creates a separately reviewed audit record.</Alert>
      <Form.Group className="mb-3">
        <Form.Label>Adjustment type</Form.Label>
        <Form.Select value={form.adjustmentType} onChange={(event) => setForm({ ...form, adjustmentType: event.target.value })}>
          <option value="increase">Increase approved spend</option>
          <option value="decrease">Decrease approved spend</option>
          <option value="reversal">Reverse remaining approved spend</option>
        </Form.Select>
      </Form.Group>
      <div className="row g-3 mb-3">
        <div className="col-md-6">
          <Form.Label>Amount ({expense.currency})</Form.Label>
          <Form.Control type="number" min="0.01" step="0.01" value={form.adjustmentType === 'reversal' ? expense.amount : form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} disabled={form.adjustmentType === 'reversal'} />
        </div>
        <div className="col-md-6">
          <Form.Label>Effective date</Form.Label>
          <Form.Control type="date" value={form.effectiveDate} onChange={(event) => setForm({ ...form, effectiveDate: event.target.value })} required />
        </div>
      </div>
      <Form.Group className="mb-4">
        <Form.Label>Reason *</Form.Label>
        <Form.Control as="textarea" rows={4} maxLength={2000} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} required />
      </Form.Group>
      <div className="d-flex justify-content-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={submitting}>{submitting ? <Spinner size="sm" animation="border" /> : 'Submit adjustment'}</Button>
      </div>
    </Form>
  );
}
