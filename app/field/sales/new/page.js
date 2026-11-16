'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useDraft, useFieldLeads, useFieldMutation, useFieldSummary } from '@/hooks/useField';
import { FIELD_OPTIONS, labelOf } from '@/lib/cleanCooking/fieldOptions';
import FieldShell from '@/components/field/FieldShell';
import { Choice, CustomerSection, SubmitBar, TextField, todayISO } from '@/components/field/FormControls';
import styles from '../../field.module.css';

const INITIAL = {
  customerType: '', gender: '', ageBand: '', institutionType: '', contactPersonRole: '',
  consentShareIdentity: undefined, consentFollowUp: false, customerName: '', customerPhone: '',
  leadId: '', saleDate: todayISO(), location: '',
  brand: '', model: '', sizeLitres: '', quantity: '1', unitPriceUgx: '', supplierCompanyId: '',
  paymentChannel: '', financing: '', notes: '',
};

export default function NewSalePage() {
  return (
    <FieldShell title="Record a sale">
      <Suspense fallback={null}><NewSaleForm /></Suspense>
    </FieldShell>
  );
}

function NewSaleForm() {
  const params = useSearchParams();
  const fromLead = params.get('leadId') || '';
  const draft = useDraft(fromLead ? `sale-from-${fromLead}` : 'sale', INITIAL);
  const summary = useFieldSummary();
  const leads = useFieldLeads();
  const mutation = useFieldMutation();
  const [done, setDone] = useState(null);
  const v = draft.value;
  const update = draft.update;

  // Pre-fill customer details from the lead being converted.
  const lead = (leads.data || []).find((l) => l.$id === fromLead);
  useEffect(() => {
    if (!lead || v.leadId === lead.$id) return;
    update({
      leadId: lead.$id,
      customerType: lead.customerType,
      gender: lead.gender || '',
      ageBand: lead.ageBand || '',
      institutionType: lead.institutionType || '',
      contactPersonRole: lead.contactPersonRole || '',
      consentShareIdentity: lead.consentShareIdentity,
      consentFollowUp: lead.consentFollowUp,
      customerName: lead.customerName || '',
      customerPhone: lead.customerPhone || '',
      location: lead.location || '',
    });
  }, [lead, v.leadId, update]);

  const submit = (e) => {
    e.preventDefault();
    mutation.mutate({ path: '/sales', method: 'POST', body: v }, {
      onSuccess: (data) => { setDone(data.sale); draft.clear(); },
    });
  };

  if (done) {
    return (
      <section className={`${styles.card} ${styles.success}`}>
        <i className="bi bi-check-circle-fill" aria-hidden="true" />
        <h1 className={styles.title}>Sale recorded</h1>
        <p className={styles.muted}>{done.quantity} × {done.brand}{done.sizeLitres ? ` ${done.sizeLitres}L` : ''}. NREP will verify it.</p>
        {done.consentFollowUp && <p className={styles.muted}>We’ll remind you to follow up with the customer in about a month.</p>}
        <div className="d-grid gap-2 mt-3">
          <button type="button" className={styles.primary} onClick={() => setDone(null)}>Record another sale</button>
          <Link href="/field" className={styles.secondary + ' d-flex align-items-center justify-content-center text-decoration-none'}>Back to home</Link>
        </div>
      </section>
    );
  }

  const brands = summary.data?.brands || [];
  const companies = summary.data?.companies || [];

  return (
    <form onSubmit={submit}>
      {draft.restored && <p className={styles.notice}><i className="bi bi-arrow-counterclockwise me-1" />We restored the sale you were typing. <button type="button" className="btn btn-link btn-sm p-0" onClick={draft.clear}>Start fresh</button></p>}
      {lead && (
        <p className={styles.notice}>
          <i className="bi bi-link-45deg me-1" />Converting your lead from {new Date(lead.generatedOn).toLocaleDateString('en-UG')} ({labelOf('leadSource', lead.source)}). It will be marked as a sale.
        </p>
      )}

      <section className={styles.formCard}>
        <h2 className={styles.sectionTitle}>The cooker</h2>
        <TextField label="Brand" value={v.brand} onChange={(x) => update({ brand: x })} list="field-brands" required maxLength={100} placeholder="e.g. Tefal, Ekopot, Digi Wave" />
        <datalist id="field-brands">{brands.map((b) => <option key={b} value={b} />)}</datalist>
        <div className={styles.row2}>
          <TextField label="Size (litres)" type="number" inputMode="decimal" min="0" step="0.5" value={v.sizeLitres} onChange={(x) => update({ sizeLitres: x })} placeholder="6" />
          <TextField label="How many?" type="number" inputMode="numeric" min="1" step="1" value={v.quantity} onChange={(x) => update({ quantity: x })} required />
        </div>
        <TextField label="Model (if known)" value={v.model} onChange={(x) => update({ model: x })} maxLength={100} />
        <TextField label="Price per cooker (UGX)" type="number" inputMode="numeric" min="0" step="1000" value={v.unitPriceUgx} onChange={(x) => update({ unitPriceUgx: x })} placeholder="e.g. 350000" />
        {companies.length > 0 && (
          <div className={styles.fieldset}>
            <label className={styles.label} htmlFor="supplier">Supplied by (company)</label>
            <select id="supplier" className={styles.input} value={v.supplierCompanyId} onChange={(e) => update({ supplierCompanyId: e.target.value })}>
              <option value="">Not sure / other</option>
              {companies.map((c) => <option key={c.$id} value={c.$id}>{c.name}</option>)}
            </select>
          </div>
        )}
      </section>

      <section className={styles.formCard}>
        <h2 className={styles.sectionTitle}>Payment</h2>
        <Choice label="How did they pay?" name="paymentChannel" columns={2} options={FIELD_OPTIONS.paymentChannel} value={v.paymentChannel} onChange={(x) => update({ paymentChannel: x })} required />
        <Choice label="Financing arrangement" name="financing" options={FIELD_OPTIONS.financing} value={v.financing} onChange={(x) => update({ financing: x })} required
          hint="Separate from how they paid — e.g. instalments paid by mobile money." />
      </section>

      <CustomerSection value={v} update={update} />

      <section className={styles.formCard}>
        <h2 className={styles.sectionTitle}>When & where</h2>
        <div className={styles.row2}>
          <TextField label="Sale date" type="date" value={v.saleDate} onChange={(x) => update({ saleDate: x })} max={todayISO()} required />
          <TextField label="Village / area" value={v.location} onChange={(x) => update({ location: x })} maxLength={160} />
        </div>
        <TextField label="Notes" type="textarea" value={v.notes} onChange={(x) => update({ notes: x })} maxLength={500} />
      </section>

      <SubmitBar pending={mutation.isPending} label="Save sale" error={mutation.error?.message} offline={mutation.error?.offline} />
    </form>
  );
}
