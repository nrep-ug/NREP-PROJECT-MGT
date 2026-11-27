'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Modal, Spinner, Table } from 'react-bootstrap';
import AppLayout from '@/components/AppLayout';
import BudgetProposalDetail from '@/components/finance/BudgetProposalDetail';
import FinanceWorkspace from '@/components/finance/FinanceWorkspace';
import financeStyles from '@/components/finance/FinanceWorkspace.module.css';
import EmptyState from '@/components/ui/EmptyState';
import Toast, { useToast } from '@/components/Toast';
import { useFinanceContext } from '@/hooks/useFinanceContext';
import { authenticatedFetch } from '@/lib/apiClient';
import { formatCurrency, formatFinanceDate } from '@/lib/financeFormat';

/**
 * The Budget Approver's own screen — Budget Proposals Awaiting Approval.
 * Deliberately separate from the expense/reallocation Review Queue (Section
 * U): a validated proposal is this actor's decision; an ordinary expense
 * is a Finance Reviewer's.
 */
export default function BudgetApprovalsPage() {
  const { user, finance, loading: contextLoading, error: contextError } = useFinanceContext();
  const { toast, showToast, hideToast } = useToast();
  const [queue, setQueue] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!finance?.actor?.canApproveBudgets) return;
    setLoading(true);
    setError('');
    try {
      const response = await authenticatedFetch('/api/finance/budget-lines/approval-queue');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Budget approvals could not be loaded.');
      setQueue(data.awaitingApproval || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [finance]);

  useEffect(() => { load(); }, [load]);

  const decide = async (action, comment) => {
    if ((action === 'return' || action === 'reject') && !comment.trim()) {
      showToast('A comment is required for this decision.', 'warning');
      return;
    }
    setDeciding(true);
    try {
      const response = await authenticatedFetch(`/api/finance/budget-lines/${selected.$id}/approve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, comment }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'The decision could not be saved.');
      showToast(action === 'approve' ? 'Budget proposal approved.' : action === 'return' ? 'Returned for correction.' : 'Rejected.', 'success');
      setSelected(null);
      await load();
    } catch (requestError) {
      showToast(requestError.message, 'danger');
    } finally {
      setDeciding(false);
    }
  };

  if (contextLoading) return <AppLayout user={user}><div className="text-center py-5"><Spinner animation="border" /></div></AppLayout>;
  if (contextError || !finance) return <AppLayout user={user}><Alert variant="danger" className="mt-4">{contextError}</Alert></AppLayout>;

  return (
    <FinanceWorkspace
      user={user}
      finance={finance}
      active="approvals"
      title="Budget Approvals"
      description="Activity budget proposals that have been financially validated and are ready for a final decision."
    >
      <Toast toast={toast} onClose={hideToast} />
      {!finance.actor.canApproveBudgets ? (
        <Alert variant="warning">This screen is restricted to configured Budget Approvers.</Alert>
      ) : (
        <>
          {error && <Alert variant="danger">{error}</Alert>}
          {loading ? <div className="text-center py-5"><Spinner animation="border" /></div> : !queue?.length ? (
            <EmptyState icon="bi-check2-circle" title="Nothing awaiting approval" text="Validated budget proposals will appear here." />
          ) : (
            <div className={financeStyles.tableWrap}>
              <Table hover className={financeStyles.dataTable}>
                <thead><tr><th>Activity</th><th className="text-end">Proposed</th><th>Validated by</th><th>Prepared by</th><th /></tr></thead>
                <tbody>{queue.map((line) => (
                  <tr key={line.$id} style={{ cursor: 'pointer' }} onClick={() => setSelected(line)}>
                    <td><div className="fw-semibold">{line.activityCode || '—'}</div><small className="text-muted">{line.activityName}</small></td>
                    <td className="text-end fw-semibold">{formatCurrency(line.originalAmount, line.currency)}</td>
                    <td>{line.validatedByName || '—'}<div className="small text-muted">{formatFinanceDate(line.validatedAt)}</div></td>
                    <td>{line.createdByName}</td>
                    <td className="text-end"><i className="bi bi-chevron-right text-muted" /></td>
                  </tr>
                ))}</tbody>
              </Table>
            </div>
          )}
        </>
      )}

      <Modal show={Boolean(selected)} onHide={() => setSelected(null)} size="lg" centered scrollable>
        <Modal.Header closeButton><Modal.Title>Activity Budget Proposal</Modal.Title></Modal.Header>
        <Modal.Body>{selected && (
          <BudgetProposalDetail line={selected} actor={finance.actor} onApprove={decide} submitting={deciding} />
        )}</Modal.Body>
      </Modal>
    </FinanceWorkspace>
  );
}
