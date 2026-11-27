'use client';

import { useMemo, useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { formatCurrency, titleCase } from '@/lib/financeFormat';

const CATEGORIES = ['personnel', 'travel', 'supplies', 'equipment', 'services', 'training', 'communications', 'venue', 'other'];
const PAYMENT_METHODS = ['bank_transfer', 'mobile_money', 'cash', 'cheque', 'card', 'other'];

export default function ExpenditureForm({ project, budgetLines = [], staff = [], initialValue = null, onSubmit, submitting, onCancel }) {
  const [form, setForm] = useState({
    budgetLineId: initialValue?.budgetLineId || '',
    amount: initialValue?.amount || '',
    expenseDate: initialValue?.expenseDate?.slice(0, 10) || new Date().toISOString().slice(0, 10),
    category: initialValue?.category || 'other',
    description: initialValue?.description || '',
    payee: initialValue?.payee || '',
    responsibleStaffId: initialValue?.responsibleStaffId || '',
    paymentMethod: initialValue?.paymentMethod || 'bank_transfer',
    referenceNumber: initialValue?.referenceNumber || '',
  });
  const [error, setError] = useState('');
  const approvedLines = useMemo(() => budgetLines.filter((line) => line.status === 'approved'), [budgetLines]);

  const submit = (event) => {
    event.preventDefault();
    if (!form.budgetLineId) return setError('Select an approved activity budget.');
    if (!form.amount || Number(form.amount) <= 0) return setError('Enter an expense amount greater than zero.');
    if (!form.payee.trim() || !form.description.trim()) return setError('Payee and description are required.');
    if (!form.responsibleStaffId) return setError('Select the staff member responsible for the activity.');
    setError('');
    onSubmit({
      projectId: project.$id,
      ...form,
      expenseDate: new Date(`${form.expenseDate}T12:00:00.000Z`).toISOString(),
    });
  };

  if (approvedLines.length === 0) {
    return <Alert variant="warning">This project has no approved activity budget yet.</Alert>;
  }

  return (
    <Form onSubmit={submit}>
      {error && <Alert variant="danger">{error}</Alert>}
      <Form.Group className="mb-3">
        <Form.Label>Activity budget *</Form.Label>
        <Form.Select value={form.budgetLineId} onChange={(event) => setForm({ ...form, budgetLineId: event.target.value })} required>
          <option value="">Choose an activity</option>
          {approvedLines.map((line) => (
            <option key={line.$id} value={line.$id}>
              {line.activityCode ? `${line.activityCode} · ` : ''}{line.activityName} — {formatCurrency(line.availableBalance, line.currency)} available
            </option>
          ))}
        </Form.Select>
      </Form.Group>
      <div className="row g-3 mb-3">
        <div className="col-md-6">
          <Form.Label>Amount ({project.budgetCurrency}) *</Form.Label>
          <Form.Control type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} required />
        </div>
        <div className="col-md-6">
          <Form.Label>Expense date *</Form.Label>
          <Form.Control type="date" value={form.expenseDate} onChange={(event) => setForm({ ...form, expenseDate: event.target.value })} required />
        </div>
      </div>
      <div className="row g-3 mb-3">
        <div className="col-md-6">
          <Form.Label>Category *</Form.Label>
          <Form.Select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
            {CATEGORIES.map((category) => <option key={category} value={category}>{titleCase(category)}</option>)}
          </Form.Select>
        </div>
        <div className="col-md-6">
          <Form.Label>Payment method *</Form.Label>
          <Form.Select value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value })}>
            {PAYMENT_METHODS.map((method) => <option key={method} value={method}>{titleCase(method)}</option>)}
          </Form.Select>
        </div>
      </div>
      <div className="row g-3 mb-3">
        <div className="col-md-6">
          <Form.Label>Payee / recipient *</Form.Label>
          <Form.Control maxLength={190} value={form.payee} onChange={(event) => setForm({ ...form, payee: event.target.value })} required />
        </div>
        <div className="col-md-6">
          <Form.Label>Responsible staff *</Form.Label>
          <Form.Select value={form.responsibleStaffId} onChange={(event) => setForm({ ...form, responsibleStaffId: event.target.value })} required>
            <option value="">Choose staff member</option>
            {staff.map((person) => <option key={person.accountId} value={person.accountId}>{person.name}{person.title ? ` · ${person.title}` : ''}</option>)}
          </Form.Select>
        </div>
      </div>
      <Form.Group className="mb-3">
        <Form.Label>Description *</Form.Label>
        <Form.Control as="textarea" rows={3} maxLength={2000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} required />
      </Form.Group>
      <Form.Group className="mb-4">
        <Form.Label>Voucher / reference number</Form.Label>
        <Form.Control maxLength={120} value={form.referenceNumber} onChange={(event) => setForm({ ...form, referenceNumber: event.target.value })} />
      </Form.Group>
      <Alert variant="info" className="small">The expense is saved as a draft first. Add evidence and submit it from the expense record.</Alert>
      <div className="d-flex justify-content-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={submitting}>{submitting ? <Spinner size="sm" animation="border" /> : initialValue ? 'Save draft' : 'Create draft'}</Button>
      </div>
    </Form>
  );
}
