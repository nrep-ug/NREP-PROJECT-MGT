'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useFieldLeads, useFieldMutation } from '@/hooks/useField';
import { FIELD_OPTIONS, labelOf, OPEN_LEAD_STAGES } from '@/lib/cleanCooking/fieldOptions';
import FieldShell from '@/components/field/FieldShell';
import { Choice, SubmitBar, TextField, todayISO } from '@/components/field/FormControls';
import styles from '../../field.module.css';

export default function LeadDetailPage() {
  return <FieldShell title="Lead" back="/field/leads"><LeadDetail /></FieldShell>;
}

const toDateInput = (iso) => (iso ? iso.slice(0, 10) : '');

function LeadDetail() {
  const { leadId } = useParams();
  const leads = useFieldLeads();
  const mutation = useFieldMutation();
  const lead = (leads.data || []).find((l) => l.$id === leadId);
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (lead && !form) {
      setForm({
        stage: lead.stage,
        mainBarrier: lead.mainBarrier || 'none',
        nextAction: lead.nextAction || '',
        followUpDate: toDateInput(lead.followUpDate),
        notes: lead.notes || '',
      });
    }
  }, [lead, form]);

  if (leads.isLoading) return <p className={styles.empty}>Loading…</p>;
  if (leads.isError) return <p className={styles.error}>{leads.error.message}</p>;
  if (!lead) return <p className={styles.empty}>Lead not found.</p>;

  const isOpen = OPEN_LEAD_STAGES.includes(lead.stage);
  const who = lead.customerName || (lead.customerType === 'institution' ? labelOf('institutionType', lead.institutionType) : 'Customer');

  const submit = (e) => {
    e.preventDefault();
    setSaved(false);
    mutation.mutate({ path: `/leads/${lead.$id}`, method: 'PATCH', body: form }, { onSuccess: () => setSaved(true) });
  };

  return (
    <>
      <section className={styles.formCard}>
        <h1 className={styles.h1}>{who}</h1>
        <div className={styles.listMeta}>
          <span className={styles.chip}>{labelOf('leadStage', lead.stage)}</span>
          <span>{labelOf('leadSource', lead.source)}</span>
          <span>{new Date(lead.generatedOn).toLocaleDateString('en-UG')}</span>
        </div>
        {lead.customerPhone && <p className="mt-2 mb-0"><a href={`tel:${lead.customerPhone}`}><i className="bi bi-telephone me-1" />{lead.customerPhone}</a></p>}
        {lead.sourceDetail && <p className={`${styles.muted} mt-2 mb-0`}>{lead.sourceDetail}</p>}
      </section>

      {isOpen ? (
        <>
          <Link href={`/field/sales/new?leadId=${lead.$id}`} className={`${styles.primary} d-flex align-items-center justify-content-center text-decoration-none mb-3`}>
            <i className="bi bi-cart-check me-2" />They bought — record the sale
          </Link>
          {form && (
            <form onSubmit={submit}>
              <section className={styles.formCard}>
                <h2 className={styles.sectionTitle}>Update progress</h2>
                <Choice label="Stage" name="stage" options={FIELD_OPTIONS.leadStage.filter((o) => o.value !== 'converted_to_sale')} value={form.stage} onChange={(x) => setForm({ ...form, stage: x })} required />
                <Choice label="Main barrier" name="mainBarrier" options={FIELD_OPTIONS.mainBarrier} value={form.mainBarrier} onChange={(x) => setForm({ ...form, mainBarrier: x })} required />
                <TextField label="Next action" value={form.nextAction} onChange={(x) => setForm({ ...form, nextAction: x })} maxLength={300} />
                <TextField label="Follow up by" type="date" value={form.followUpDate} onChange={(x) => setForm({ ...form, followUpDate: x })} min={todayISO()} />
                <TextField label="Notes" type="textarea" value={form.notes} onChange={(x) => setForm({ ...form, notes: x })} maxLength={500} />
              </section>
              {saved && !mutation.isPending && <p className={styles.notice}><i className="bi bi-check2 me-1" />Saved.</p>}
              <SubmitBar pending={mutation.isPending} label="Save progress" error={mutation.error?.message} offline={mutation.error?.offline} />
            </form>
          )}
        </>
      ) : (
        <p className={styles.empty}>
          {lead.stage === 'converted_to_sale' ? 'This lead became a sale. 🎉' : 'This lead was closed without a sale.'}
        </p>
      )}
    </>
  );
}
