'use client';

import { useState } from 'react';
import { newSubmissionId, useFieldFollowups, useFieldMutation } from '@/hooks/useField';
import { FIELD_OPTIONS, labelOf } from '@/lib/cleanCooking/fieldOptions';
import FieldShell from '@/components/field/FieldShell';
import { Choice, MultiChoice, SubmitBar, TextField, todayISO } from '@/components/field/FormControls';
import styles from '../field.module.css';

export default function FollowUpsPage() {
  return <FieldShell title="Follow-ups"><FollowUps /></FieldShell>;
}

const fmt = (iso) => new Date(iso).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' });

function saleLabel(sale) {
  const who = sale.customerName || (sale.customerType === 'institution' ? labelOf('institutionType', sale.institutionType) : 'Customer');
  return `${who} · ${sale.quantity} × ${sale.brand}${sale.sizeLitres ? ` ${sale.sizeLitres}L` : ''}`;
}

function FollowUpForm({ item, onDone }) {
  const mutation = useFieldMutation();
  const [form, setForm] = useState({
    clientSubmissionId: newSubmissionId(),
    saleId: item.sale.$id,
    conductedOn: todayISO(),
    method: item.sale.customerPhone ? 'phone_call' : 'visit',
    usageStatus: '',
    usageFrequency: '',
    barriers: [],
    notes: '',
  });
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const inUse = form.usageStatus === 'regular_use' || form.usageStatus === 'occasional_use';

  const submit = (e) => {
    e.preventDefault();
    mutation.mutate({ path: '/followups', method: 'POST', body: form }, { onSuccess: () => onDone(form.usageStatus) });
  };

  return (
    <form onSubmit={submit}>
      <section className={styles.formCard}>
        <h2 className={styles.sectionTitle}>{saleLabel(item.sale)}</h2>
        <p className={styles.hint}>Sold {fmt(item.sale.saleDate)}{item.sale.location ? ` · ${item.sale.location}` : ''}</p>
        {item.sale.customerPhone && <p><a href={`tel:${item.sale.customerPhone}`}><i className="bi bi-telephone me-1" />Call {item.sale.customerPhone}</a></p>}
        <Choice label="How did you follow up?" name="method" columns={2} options={FIELD_OPTIONS.followUpMethod} value={form.method} onChange={(x) => set({ method: x })} required />
        <TextField label="Date" type="date" value={form.conductedOn} onChange={(x) => set({ conductedOn: x })} max={todayISO()} required />
        <Choice label="Is the customer using the cooker?" name="usageStatus" options={FIELD_OPTIONS.usageStatus} value={form.usageStatus} onChange={(x) => set({ usageStatus: x })} required />
        {inUse && (
          <Choice label="How often?" name="usageFrequency" options={FIELD_OPTIONS.usageFrequency} value={form.usageFrequency} onChange={(x) => set({ usageFrequency: x })} required />
        )}
        {form.usageStatus && form.usageStatus !== 'not_reached' && (
          <MultiChoice label="Any problems using it?" name="barriers" options={FIELD_OPTIONS.usageBarrier} value={form.barriers} onChange={(x) => set({ barriers: x })} exclusive="none" hint="Choose all that apply." />
        )}
        <TextField label="Notes" type="textarea" value={form.notes} onChange={(x) => set({ notes: x })} maxLength={500} />
      </section>
      <SubmitBar pending={mutation.isPending} label="Save follow-up" error={mutation.error?.message} offline={mutation.error?.offline} />
    </form>
  );
}

function FollowUps() {
  const query = useFieldFollowups();
  const [active, setActive] = useState(null);
  const [message, setMessage] = useState('');

  if (query.isLoading) return <p className={styles.empty}>Loading…</p>;
  if (query.isError) return <p className={styles.error}>{query.error.message}</p>;

  if (active) {
    return (
      <>
        <button type="button" className={`${styles.secondary} mb-3`} onClick={() => setActive(null)}><i className="bi bi-x-lg me-1" />Cancel</button>
        <FollowUpForm
          item={active}
          onDone={(status) => {
            setActive(null);
            setMessage(status === 'not_reached' ? 'Saved. This customer stays on your list so you can try again.' : 'Follow-up saved. Thank you!');
          }}
        />
      </>
    );
  }

  const { due, upcoming, done, followUpAfterDays } = query.data;
  const row = (item, canStart) => (
    <div key={item.sale.$id} className={styles.listItem}>
      <strong>{saleLabel(item.sale)}</strong>
      <span className={styles.listMeta}>
        <span className={`${styles.chip} ${canStart ? styles.chipWarn : styles.chipMuted}`}>{canStart ? 'Due' : 'From'} {fmt(item.dueOn)}</span>
        {item.attempts > 0 && <span>{item.attempts} attempt{item.attempts === 1 ? '' : 's'} so far</span>}
      </span>
      {canStart && <button type="button" className={`${styles.primary} w-100 mt-2`} onClick={() => { setMessage(''); setActive(item); }}>Record follow-up</button>}
    </div>
  );

  return (
    <>
      {message && <p className={styles.notice}><i className="bi bi-check2 me-1" />{message}</p>}
      <p className={styles.hint}>Customers who agreed to be contacted appear here {followUpAfterDays} days after their purchase. Ask whether they are using the cooker.</p>
      <h1 className={styles.h1}>Due now ({due.length})</h1>
      {due.length ? <div className={`${styles.list} mb-4`}>{due.map((i) => row(i, true))}</div> : <p className={`${styles.empty} mb-4`}>Nothing due. Well done!</p>}
      {upcoming.length > 0 && (
        <>
          <h1 className={styles.h1}>Coming up ({upcoming.length})</h1>
          <div className={`${styles.list} mb-4`}>{upcoming.map((i) => row(i, false))}</div>
        </>
      )}
      {done.length > 0 && (
        <>
          <h1 className={styles.h1}>Done ({done.length})</h1>
          <div className={styles.list}>
            {done.map((f) => (
              <div key={f.$id} className={styles.listItem}>
                <strong>{labelOf('usageStatus', f.usageStatus)}</strong>
                <span className={styles.listMeta}><span>{fmt(f.conductedOn)}</span><span>{labelOf('followUpMethod', f.method)}</span></span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
