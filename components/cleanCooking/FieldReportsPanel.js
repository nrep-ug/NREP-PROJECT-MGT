'use client';

import { useMemo, useState } from 'react';
import { Alert, Button, Form, Modal, Spinner } from 'react-bootstrap';
import { useCleanCookingFieldReports, useCleanCookingMutation } from '@/hooks/useCleanCooking';
import { FIELD_OPTIONS, labelOf } from '@/lib/cleanCooking/fieldOptions';
import SectionCard from '@/components/ui/SectionCard';
import EmptyState from '@/components/ui/EmptyState';
import styles from './CleanCooking.module.css';

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const STATUS_TONE = { verified: '', submitted: styles.pillMuted, needs_review: styles.pillLead, rejected: styles.pillMuted };

function customerSummary(r) {
  const who = r.customerType === 'institution'
    ? labelOf('institutionType', r.institutionType)
    : [labelOf('gender', r.gender), r.ageBand ? labelOf('ageBand', r.ageBand) : null].filter((x) => x && x !== '—').join(', ') || 'Individual';
  const name = r.customerName && r.customerName !== 'hidden' ? r.customerName : null;
  return { who, name, anonymised: !r.consentShareIdentity };
}

function VerifyModal({ target, onHide, projectId, showToast }) {
  const mutation = useCleanCookingMutation(projectId);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  if (!target) return null;
  const { sale, status } = target;
  const needsNote = status !== 'verified';
  const submit = (e) => {
    e.preventDefault();
    setError('');
    mutation.mutate({ path: `/field-reports/sales/${sale.$id}`, method: 'PATCH', body: { verificationStatus: status, verificationNote: note } }, {
      onSuccess: () => { showToast?.(`Sale marked ${labelOf('verificationStatus', status).toLowerCase()}.`, 'success'); setNote(''); onHide(); },
      onError: (err) => setError(err.message),
    });
  };
  return (
    <Modal show onHide={() => { setNote(''); onHide(); }} centered>
      <Form onSubmit={submit}>
        <Modal.Header closeButton><Modal.Title as="h2" className="h5">{labelOf('verificationStatus', status)}: {sale.quantity} × {sale.brand}</Modal.Title></Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          <p className="small text-muted mb-2">Only verified sales count as programme results.</p>
          <Form.Group>
            <Form.Label>{needsNote ? 'Reason (the champion will see this)' : 'Note (optional)'}</Form.Label>
            <Form.Control as="textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} required={needsNote} maxLength={500}
              placeholder={needsNote ? 'e.g. Please confirm the customer’s phone number' : 'e.g. Confirmed by phone with the customer'} />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => { setNote(''); onHide(); }}>Cancel</Button>
          <Button type="submit" className={styles.primaryButton} disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Confirm'}</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

export default function FieldReportsPanel({ projectId, access, showToast }) {
  const { data, isLoading, error } = useCleanCookingFieldReports(projectId);
  const [view, setView] = useState('sales');
  const [statusFilter, setStatusFilter] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [verifyTarget, setVerifyTarget] = useState(null);

  const names = data?.championNames || {};
  const sales = useMemo(() => (data?.sales || []).filter((s) => !statusFilter || s.verificationStatus === statusFilter), [data, statusFilter]);
  const leads = useMemo(() => (data?.leads || []).filter((l) => !stageFilter || l.stage === stageFilter), [data, stageFilter]);
  const followups = data?.followups || [];
  const pending = (data?.sales || []).filter((s) => s.verificationStatus === 'submitted' || s.verificationStatus === 'needs_review').length;

  if (isLoading) return <div className="text-center py-5"><Spinner animation="border" /></div>;
  if (error) {
    return (
      <Alert variant="warning">
        {error.message}
        {error.status === 404 && ' — the field-report tables may not be set up yet (npm run schema:clean-cooking -- --apply).'}
      </Alert>
    );
  }

  const tabs = [
    { key: 'sales', label: `Champion sales (${data.sales.length})`, icon: 'bi-cart-check' },
    { key: 'leads', label: `Leads (${data.leads.length})`, icon: 'bi-person-plus' },
    { key: 'followups', label: `Follow-ups (${followups.length})`, icon: 'bi-telephone-forward' },
  ];

  return (
    <SectionCard
      title="Field reports from champions"
      description={pending ? `${pending} sale record${pending === 1 ? '' : 's'} waiting for verification` : 'Everything submitted has been reviewed.'}
      flush
    >
      <div className="px-3 pt-3">
        <div className={styles.toolbar}>
          <nav className={styles.subnav} aria-label="Field report types">
            {tabs.map((t) => (
              <button key={t.key} type="button" className={`${styles.subnavButton} ${view === t.key ? styles.subnavActive : ''}`} onClick={() => setView(t.key)}>
                <i className={`bi ${t.icon}`} />{t.label}
              </button>
            ))}
          </nav>
          {view === 'sales' && (
            <Form.Select size="sm" aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ maxWidth: 200 }}>
              <option value="">All statuses</option>
              {FIELD_OPTIONS.verificationStatus.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Form.Select>
          )}
          {view === 'leads' && (
            <Form.Select size="sm" aria-label="Filter by stage" value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} style={{ maxWidth: 220 }}>
              <option value="">All stages</option>
              {FIELD_OPTIONS.leadStage.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Form.Select>
          )}
        </div>
      </div>

      {view === 'sales' && (sales.length === 0 ? (
        <EmptyState icon="bi-cart" title="No champion sales yet" text="Sales recorded by champions in the portal appear here for verification." />
      ) : (
        <div className={styles.tableWrap}>
          <table className={`table table-hover ${styles.table}`}>
            <thead><tr><th>Date</th><th>Champion</th><th>Customer</th><th>EPC</th><th className={styles.num}>Qty</th><th>Payment</th><th>Status</th>{access.canManage && <th aria-label="Actions" />}</tr></thead>
            <tbody>
              {sales.map((s) => {
                const c = customerSummary(s);
                return (
                  <tr key={s.$id}>
                    <td className="text-nowrap">{fmtDate(s.saleDate)}</td>
                    <td><div className={styles.strong}>{names[s.championId] || '—'}</div><small className={styles.muted}>{s.district}{s.location ? ` · ${s.location}` : ''}</small></td>
                    <td>
                      <div>{c.name || <span className={styles.muted}>{c.anonymised ? 'Anonymous' : '—'}</span>}</div>
                      <small className={styles.muted}>{c.who}</small>
                    </td>
                    <td>{s.brand}{s.sizeLitres ? ` ${s.sizeLitres}L` : ''}{s.model ? <small className={`d-block ${styles.muted}`}>{s.model}</small> : null}</td>
                    <td className={`${styles.num} ${styles.strong}`}>{s.quantity}</td>
                    <td><div>{labelOf('paymentChannel', s.paymentChannel)}</div><small className={styles.muted}>{labelOf('financing', s.financing)}</small></td>
                    <td>
                      <span className={`${styles.pill} ${STATUS_TONE[s.verificationStatus] || ''}`}>{labelOf('verificationStatus', s.verificationStatus)}</span>
                      {s.verificationNote && <small className={`d-block ${styles.muted}`} title={s.verificationNote}>{s.verificationNote.slice(0, 40)}{s.verificationNote.length > 40 ? '…' : ''}</small>}
                    </td>
                    {access.canManage && (
                      <td className="text-end text-nowrap">
                        {s.verificationStatus !== 'verified' && <Button size="sm" variant="link" className="p-1" onClick={() => setVerifyTarget({ sale: s, status: 'verified' })}>Verify</Button>}
                        {s.verificationStatus !== 'needs_review' && <Button size="sm" variant="link" className="p-1" onClick={() => setVerifyTarget({ sale: s, status: 'needs_review' })}>Query</Button>}
                        {s.verificationStatus !== 'rejected' && <Button size="sm" variant="link" className="p-1 text-danger" onClick={() => setVerifyTarget({ sale: s, status: 'rejected' })}>Reject</Button>}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      {view === 'leads' && (leads.length === 0 ? (
        <EmptyState icon="bi-person-plus" title="No leads yet" text="Leads recorded by champions appear here with their stage and next action." />
      ) : (
        <div className={styles.tableWrap}>
          <table className={`table table-hover ${styles.table}`}>
            <thead><tr><th>Date</th><th>Champion</th><th>Customer</th><th>Source</th><th>Stage</th><th>Main barrier</th><th>Next action</th></tr></thead>
            <tbody>
              {leads.map((l) => {
                const c = customerSummary(l);
                const overdue = l.followUpDate && new Date(l.followUpDate) < new Date() && !['converted_to_sale', 'closed_without_sale'].includes(l.stage);
                return (
                  <tr key={l.$id}>
                    <td className="text-nowrap">{fmtDate(l.generatedOn)}</td>
                    <td><div className={styles.strong}>{names[l.championId] || '—'}</div><small className={styles.muted}>{l.district}</small></td>
                    <td><div>{c.name || <span className={styles.muted}>{c.anonymised ? 'Anonymous' : '—'}</span>}</div><small className={styles.muted}>{c.who}</small></td>
                    <td>{labelOf('leadSource', l.source)}{l.sourceDetail && <small className={`d-block ${styles.muted}`}>{l.sourceDetail}</small>}</td>
                    <td><span className={`${styles.pill} ${l.stage === 'closed_without_sale' ? styles.pillMuted : ''}`}>{labelOf('leadStage', l.stage)}</span></td>
                    <td>{labelOf('mainBarrier', l.mainBarrier)}</td>
                    <td>
                      {l.nextAction || <span className={styles.muted}>—</span>}
                      {l.followUpDate && <small className={`d-block ${overdue ? 'text-danger' : styles.muted}`}>{overdue ? 'Overdue · ' : 'By '}{fmtDate(l.followUpDate)}</small>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      {view === 'followups' && (followups.length === 0 ? (
        <EmptyState icon="bi-telephone-forward" title="No follow-ups yet" text={`Champions are reminded to follow up customers who agreed, about a month after the sale.`} />
      ) : (
        <div className={styles.tableWrap}>
          <table className={`table table-hover ${styles.table}`}>
            <thead><tr><th>Date</th><th>Champion</th><th>How</th><th>Usage</th><th>How often</th><th>Problems</th></tr></thead>
            <tbody>
              {followups.map((f) => (
                <tr key={f.$id}>
                  <td className="text-nowrap">{fmtDate(f.conductedOn)}</td>
                  <td><div className={styles.strong}>{names[f.championId] || '—'}</div><small className={styles.muted}>{f.district}</small></td>
                  <td>{labelOf('followUpMethod', f.method)}</td>
                  <td><span className={`${styles.pill} ${f.usageStatus === 'regular_use' || f.usageStatus === 'occasional_use' ? '' : styles.pillMuted}`}>{labelOf('usageStatus', f.usageStatus)}</span></td>
                  <td>{f.usageFrequency ? labelOf('usageFrequency', f.usageFrequency) : '—'}</td>
                  <td>{(f.barriers || []).length ? f.barriers.map((b) => labelOf('usageBarrier', b)).join(', ') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <VerifyModal target={verifyTarget} onHide={() => setVerifyTarget(null)} projectId={projectId} showToast={showToast} />
    </SectionCard>
  );
}
