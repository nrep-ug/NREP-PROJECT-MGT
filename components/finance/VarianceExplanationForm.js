'use client';

import { useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import ApproverPicker from './ApproverPicker';

const PERIODS = Object.freeze({
  financial_year: {
    label: 'Financial year',
    placeholder: '2026',
    pattern: /^\d{4}$/,
    help: 'Use YYYY, for example 2026.',
  },
  quarter: {
    label: 'Quarter',
    placeholder: '2026-Q3',
    pattern: /^\d{4}-Q[1-4]$/,
    help: 'Use YYYY-Q1 through YYYY-Q4.',
  },
  month: {
    label: 'Month',
    placeholder: '2026-09',
    pattern: /^\d{4}-(0[1-9]|1[0-2])$/,
    help: 'Use YYYY-MM, for example 2026-09.',
  },
});

function defaultPeriodKey(type, now = new Date()) {
  const year = now.getUTCFullYear();
  if (type === 'financial_year') return String(year);
  if (type === 'month') return `${year}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  return `${year}-Q${Math.floor(now.getUTCMonth() / 3) + 1}`;
}

export default function VarianceExplanationForm({
  project,
  budgetLine = null,
  activity = null,
  initialValue = null,
  onSubmit,
  onCancel,
  submitting = false,
  approvers = [],
}) {
  const initialPeriodType = initialValue?.periodType && PERIODS[initialValue.periodType]
    ? initialValue.periodType
    : 'quarter';
  const [form, setForm] = useState({
    periodType: initialPeriodType,
    periodKey: initialValue?.periodKey || defaultPeriodKey(initialPeriodType),
    explanation: initialValue?.explanation || '',
  });
  const [error, setError] = useState('');
  const [assignedReviewerId, setAssignedReviewerId] = useState(initialValue?.assignedReviewerId || '');

  const scopedActivity = activity || (budgetLine ? {
    $id: budgetLine.activityId,
    activityCode: budgetLine.activityCode,
    name: budgetLine.activityName,
  } : null);
  const activityName = scopedActivity?.name || scopedActivity?.activityName;
  const activityCode = scopedActivity?.activityCode;

  const updatePeriodType = (periodType) => {
    setForm((current) => ({
      ...current,
      periodType,
      periodKey: defaultPeriodKey(periodType),
    }));
  };

  const submit = (event) => {
    event.preventDefault();
    if (!project?.$id) return setError('Choose a project before recording an explanation.');
    const period = PERIODS[form.periodType];
    const periodKey = form.periodKey.trim().toUpperCase();
    if (!period || !period.pattern.test(periodKey)) {
      return setError(period?.help || 'Choose a valid reporting period.');
    }
    if (!form.explanation.trim()) return setError('Enter a clear variance explanation.');

    setError('');
    onSubmit?.({
      projectId: project.$id,
      budgetLineId: budgetLine?.$id || initialValue?.budgetLineId || null,
      activityId: scopedActivity?.$id || initialValue?.activityId || null,
      periodType: form.periodType,
      periodKey,
      explanation: form.explanation.trim(),
      assignedReviewerId,
    });
  };

  return (
    <Form onSubmit={submit}>
      {error && <Alert variant="danger">{error}</Alert>}
      <Alert variant="info" className="small">
        Explain material differences between the approved budget and actual financial performance for management review.
      </Alert>

      <div className="row g-3 mb-3">
        <div className="col-md-6">
          <Form.Group controlId="variance-project">
            <Form.Label>Project</Form.Label>
            <Form.Control value={`${project?.code || ''} - ${project?.name || ''}`} readOnly />
          </Form.Group>
        </div>
        <div className="col-md-6">
          <Form.Group controlId="variance-scope">
            <Form.Label>Explanation scope</Form.Label>
            <Form.Control
              value={activityName ? `${activityCode ? `${activityCode} - ` : ''}${activityName}` : 'Project level'}
              readOnly
            />
          </Form.Group>
        </div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-md-5">
          <Form.Group controlId="variance-period-type">
            <Form.Label>Period type *</Form.Label>
            <Form.Select value={form.periodType} onChange={(event) => updatePeriodType(event.target.value)}>
              {Object.entries(PERIODS).map(([value, period]) => (
                <option key={value} value={value}>{period.label}</option>
              ))}
            </Form.Select>
          </Form.Group>
        </div>
        <div className="col-md-7">
          <Form.Group controlId="variance-period-key">
            <Form.Label>Period *</Form.Label>
            <Form.Control
              value={form.periodKey}
              maxLength={12}
              placeholder={PERIODS[form.periodType].placeholder}
              onChange={(event) => setForm((current) => ({ ...current, periodKey: event.target.value }))}
              required
            />
            <Form.Text>{PERIODS[form.periodType].help}</Form.Text>
          </Form.Group>
        </div>
      </div>

      <Form.Group className="mb-4" controlId="variance-explanation">
        <Form.Label>Variance explanation *</Form.Label>
        <Form.Control
          as="textarea"
          rows={5}
          maxLength={2000}
          value={form.explanation}
          onChange={(event) => setForm((current) => ({ ...current, explanation: event.target.value }))}
          placeholder="Describe the cause, management response, and any corrective action."
          required
        />
      </Form.Group>

      <ApproverPicker approvers={approvers} kind="varianceExplanation" value={assignedReviewerId} onChange={setAssignedReviewerId} />
      <div className="d-flex justify-content-end gap-2">
        {onCancel && <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>Cancel</Button>}
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? <Spinner size="sm" animation="border" /> : initialValue ? 'Update explanation' : 'Save explanation'}
        </Button>
      </div>
    </Form>
  );
}
