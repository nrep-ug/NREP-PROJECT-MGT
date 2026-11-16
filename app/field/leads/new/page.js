'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useFieldMutation, useDraft } from '@/hooks/useField';
import { FIELD_OPTIONS, OPEN_LEAD_STAGES } from '@/lib/cleanCooking/fieldOptions';
import FieldShell from '@/components/field/FieldShell';
import { Choice, CustomerSection, SubmitBar, TextField, todayISO } from '@/components/field/FormControls';
import styles from '../../field.module.css';

const INITIAL = {
  customerType: '', gender: '', ageBand: '', institutionType: '', contactPersonRole: '',
  consentShareIdentity: undefined, consentFollowUp: false, customerName: '', customerPhone: '',
  source: '', sourceDetail: '', generatedOn: todayISO(), location: '',
  stage: 'enquiry_received', mainBarrier: 'none', nextAction: '', followUpDate: '', notes: '',
};

export default function NewLeadPage() {
  return <FieldShell title="New lead"><NewLeadForm /></FieldShell>;
}

function NewLeadForm() {
  const draft = useDraft('lead', INITIAL);
  const mutation = useFieldMutation();
  const [done, setDone] = useState(null);
  const v = draft.value;
  const update = draft.update;

  const submit = (e) => {
    e.preventDefault();
    mutation.mutate({ path: '/leads', method: 'POST', body: v }, {
      onSuccess: (data) => { setDone(data.lead); draft.clear(); },
    });
  };

  if (done) {
    return (
      <section className={`${styles.card} ${styles.success}`}>
        <i className="bi bi-check-circle-fill" aria-hidden="true" />
        <h1 className={styles.title}>Lead saved</h1>
        <p className={styles.muted}>Remember your next action{done.followUpDate ? ` by ${new Date(done.followUpDate).toLocaleDateString('en-UG')}` : ''}.</p>
        <div className="d-grid gap-2 mt-3">
          <button type="button" className={styles.primary} onClick={() => setDone(null)}>Record another lead</button>
          <Link href="/field" className={styles.secondary + ' d-flex align-items-center justify-content-center text-decoration-none'}>Back to home</Link>
        </div>
      </section>
    );
  }

  return (
    <form onSubmit={submit}>
      {draft.restored && <p className={styles.notice}><i className="bi bi-arrow-counterclockwise me-1" />We restored the lead you were typing. <button type="button" className="btn btn-link btn-sm p-0" onClick={draft.clear}>Start fresh</button></p>}

      <section className={styles.formCard}>
        <h2 className={styles.sectionTitle}>Where did this lead come from?</h2>
        <Choice label="How did you find them?" name="source" options={FIELD_OPTIONS.leadSource} value={v.source} onChange={(x) => update({ source: x })} required />
        <TextField label="Which event / where exactly?" value={v.sourceDetail} onChange={(x) => update({ sourceDetail: x })} placeholder="e.g. Demo at Kabale market, 12 Nov" maxLength={300} />
        <div className={styles.row2}>
          <TextField label="Date" type="date" value={v.generatedOn} onChange={(x) => update({ generatedOn: x })} max={todayISO()} required />
          <TextField label="Village / area" value={v.location} onChange={(x) => update({ location: x })} maxLength={160} />
        </div>
      </section>

      <CustomerSection value={v} update={update} />

      <section className={styles.formCard}>
        <h2 className={styles.sectionTitle}>Progress</h2>
        <Choice label="Stage" name="stage" options={FIELD_OPTIONS.leadStage.filter((o) => OPEN_LEAD_STAGES.includes(o.value))} value={v.stage} onChange={(x) => update({ stage: x })} required />
        <Choice label="What is stopping them from buying?" name="mainBarrier" options={FIELD_OPTIONS.mainBarrier} value={v.mainBarrier} onChange={(x) => update({ mainBarrier: x })} required />
        <TextField label="Next action" value={v.nextAction} onChange={(x) => update({ nextAction: x })} placeholder="e.g. Call back after payday, bring quotation" maxLength={300} />
        <TextField label="Follow up by" type="date" value={v.followUpDate} onChange={(x) => update({ followUpDate: x })} min={todayISO()} />
        <TextField label="Notes" type="textarea" value={v.notes} onChange={(x) => update({ notes: x })} maxLength={500} />
      </section>

      <SubmitBar pending={mutation.isPending} label="Save lead" error={mutation.error?.message} offline={mutation.error?.offline} />
    </form>
  );
}
