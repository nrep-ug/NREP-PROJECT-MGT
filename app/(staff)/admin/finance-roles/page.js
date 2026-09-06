'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Form, Spinner, Table } from 'react-bootstrap';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import Toast, { useToast } from '@/components/Toast';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import { authenticatedFetch } from '@/lib/apiClient';

const FINANCE_ROLE_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'preparer', label: 'Finance Officer' },
  { value: 'approver', label: 'Finance Reviewer' },
];

/**
 * Admin governance surface for Finance access (Section Y). Admin manages
 * WHO holds these organization-scoped roles — never transactions themselves.
 * Reuses the same team-membership mechanism the rest of the app already
 * enforces (lib/serverAuth.js::requireAuthenticatedContext); no raw Appwrite
 * team IDs are shown, only the three governance roles that matter.
 */
export default function FinanceRoleManagementPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast, showToast, hideToast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState(null);

  const load = useCallback(async () => {
    if (!user?.organizationId) return;
    setLoading(true);
    setError('');
    try {
      const response = await authenticatedFetch(`/api/admin/users?organizationId=${encodeURIComponent(user.organizationId)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Users could not be loaded.');
      setUsers((data.users || []).filter((item) => item.userType !== 'client'));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const staff = useMemo(() => users.filter((item) => item.status === 'active'), [users]);

  const updateFinanceRole = async (person, financeRole) => {
    setSavingId(person.accountId);
    try {
      const response = await authenticatedFetch(`/api/admin/users/${person.accountId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFinance: Boolean(financeRole), financeRole: financeRole || null }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Finance role could not be updated.');
      showToast(`Finance role updated for ${person.firstName} ${person.lastName}.`, 'success');
      await load();
    } catch (requestError) {
      showToast(requestError.message, 'danger');
    } finally {
      setSavingId(null);
    }
  };

  const toggleBudgetApprover = async (person, enabled) => {
    setSavingId(person.accountId);
    try {
      const response = await authenticatedFetch(`/api/admin/users/${person.accountId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ financeBudgetApprover: enabled }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Budget Approver access could not be updated.');
      showToast(`Budget Approver access ${enabled ? 'granted to' : 'removed from'} ${person.firstName} ${person.lastName}.`, 'success');
      await load();
    } catch (requestError) {
      showToast(requestError.message, 'danger');
    } finally {
      setSavingId(null);
    }
  };

  if (authLoading) return <AppLayout user={user}><div className="text-center py-5"><Spinner animation="border" /></div></AppLayout>;
  if (!user?.isAdmin) return <AppLayout user={user}><Alert variant="danger" className="mt-4">Administrator access is required.</Alert></AppLayout>;

  return (
    <AppLayout user={user}>
      <Toast toast={toast} onClose={hideToast} />
      <PageHeader
        eyebrow="Administration"
        title="Finance Roles"
        description="Assign Finance Officer, Finance Reviewer, and Budget Approver access. These roles are organization-scoped and enforce segregation of duties server-side — a Finance Officer can never also be a Budget Approver."
      />

      {error && <Alert variant="danger">{error}</Alert>}
      {loading ? <div className="text-center py-5"><Spinner animation="border" /></div> : staff.length === 0 ? (
        <EmptyState icon="bi-people" title="No active staff" text="Active staff accounts will appear here." />
      ) : (
        <div className="table-responsive" style={{ background: 'var(--nrep-card-bg)', border: '1px solid var(--nrep-border)', borderRadius: 'var(--radius-lg)' }}>
          <Table hover className="mb-0 align-middle">
            <thead>
              <tr>
                <th className="border-0 py-3 px-4 text-muted small fw-semibold text-uppercase">User</th>
                <th className="border-0 py-3 text-muted small fw-semibold text-uppercase">Organization</th>
                <th className="border-0 py-3 text-muted small fw-semibold text-uppercase">Finance role</th>
                <th className="border-0 py-3 text-muted small fw-semibold text-uppercase">Budget Approver</th>
                <th className="border-0 py-3 text-muted small fw-semibold text-uppercase">Last updated</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((person) => {
                const isBudgetApprover = (person.financeRoles || []).includes('finance_budget_approver');
                const isSaving = savingId === person.accountId;
                return (
                  <tr key={person.$id}>
                    <td className="py-3 px-4">
                      <div className="fw-semibold">{person.firstName} {person.lastName}</div>
                      <div className="small text-muted">{person.email}</div>
                    </td>
                    <td className="py-3 small text-muted">{user.organizationId}</td>
                    <td className="py-3" style={{ maxWidth: 200 }}>
                      <Form.Select
                        size="sm"
                        value={person.financeRole || ''}
                        disabled={isSaving}
                        onChange={(event) => updateFinanceRole(person, event.target.value)}
                      >
                        {FINANCE_ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </Form.Select>
                    </td>
                    <td className="py-3">
                      <Form.Check
                        type="switch"
                        id={`approver-${person.$id}`}
                        checked={isBudgetApprover}
                        disabled={isSaving || person.financeRole === 'preparer'}
                        onChange={(event) => toggleBudgetApprover(person, event.target.checked)}
                        label={isBudgetApprover ? 'Yes' : 'No'}
                        title={person.financeRole === 'preparer' ? 'A Finance Officer cannot also be a Budget Approver.' : undefined}
                      />
                    </td>
                    <td className="py-3 small text-muted">{person.$updatedAt ? new Date(person.$updatedAt).toLocaleDateString() : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      )}
    </AppLayout>
  );
}
