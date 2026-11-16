'use client';

import { useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { authenticatedFetch } from '@/lib/apiClient';
import { formatFinanceDate } from '@/lib/financeFormat';
import ApproverPicker, { eligibleApprovers } from './ApproverPicker';

export default function ExpenseEvidencePanel({ expense, canEdit, onChanged, notify, approvers = [] }) {
  const [file, setFile] = useState(null);
  const [missingReason, setMissingReason] = useState('');
  const [assignedReviewerId, setAssignedReviewerId] = useState(expense.assignedReviewerId || '');
  const needsApprover = eligibleApprovers(approvers, 'expenditure').length > 0;
  const [busy, setBusy] = useState(false);

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const response = await authenticatedFetch(`/api/finance/expenditures/${expense.$id}/evidence`, { method: 'POST', body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Evidence upload failed.');
      setFile(null);
      notify?.('Evidence uploaded.', 'success');
      onChanged?.(data.expenditure);
    } catch (error) {
      notify?.(error.message, 'danger');
    } finally {
      setBusy(false);
    }
  };

  const submitExpense = async () => {
    setBusy(true);
    try {
      const response = await authenticatedFetch(`/api/finance/expenditures/${expense.$id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evidenceMissingReason: missingReason, assignedReviewerId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Expense submission failed.');
      notify?.('Expense submitted for review.', 'success');
      onChanged?.(data.expenditure);
    } catch (error) {
      notify?.(error.message, 'danger');
    } finally {
      setBusy(false);
    }
  };

  const download = async (item) => {
    setBusy(true);
    try {
      const response = await authenticatedFetch(`/api/finance/expenditures/${expense.$id}/evidence/${item.fileId}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Evidence download failed.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = item.name || 'evidence';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      notify?.(error.message, 'danger');
    } finally {
      setBusy(false);
    }
  };

  const evidence = expense.evidenceMetadata || [];
  return (
    <div>
      <h6 className="fw-bold">Supporting evidence</h6>
      {evidence.length === 0 ? (
        <Alert variant="warning" className="small">No receipt, invoice, voucher, contract, or other evidence is attached.</Alert>
      ) : (
        <div className="d-flex flex-column gap-2 mb-3">
          {evidence.map((item) => (
            <div key={item.fileId} className="d-flex justify-content-between align-items-center gap-3 border rounded p-2">
              <div className="min-w-0">
                <div className="fw-semibold text-truncate">{item.name}</div>
                <small className="text-muted">{Math.ceil((item.size || 0) / 1024).toLocaleString()} KB · {formatFinanceDate(item.uploadedAt)}</small>
              </div>
              <Button size="sm" variant="secondary" onClick={() => download(item)} disabled={busy}><i className="bi bi-download me-1" />Open</Button>
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        <>
          <Form.Group className="mb-3">
            <Form.Label>Add evidence</Form.Label>
            <div className="d-flex flex-column flex-sm-row gap-2">
              <Form.Control type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx" onChange={(event) => setFile(event.target.files?.[0] || null)} />
              <Button variant="secondary" onClick={upload} disabled={!file || busy}>{busy ? <Spinner size="sm" animation="border" /> : 'Upload'}</Button>
            </div>
            <Form.Text>PDF, image, Word, or spreadsheet; maximum 10 MB.</Form.Text>
          </Form.Group>
          {evidence.length === 0 && (
            <Form.Group className="mb-3">
              <Form.Label>If evidence is unavailable</Form.Label>
              <Form.Control as="textarea" rows={2} maxLength={500} value={missingReason} onChange={(event) => setMissingReason(event.target.value)} placeholder="Document the exception for the reviewer" />
            </Form.Group>
          )}
          <ApproverPicker approvers={approvers} kind="expenditure" value={assignedReviewerId} onChange={setAssignedReviewerId} id={`approver-${expense.$id}`} />
          <Button variant="primary" onClick={submitExpense} disabled={busy || (evidence.length === 0 && !missingReason.trim()) || (needsApprover && !assignedReviewerId)}>
            {busy ? <Spinner size="sm" animation="border" /> : 'Submit expense for review'}
          </Button>
        </>
      )}
    </div>
  );
}
