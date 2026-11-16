'use client';

import Link from 'next/link';
import { useFieldLeads } from '@/hooks/useField';
import { labelOf, OPEN_LEAD_STAGES } from '@/lib/cleanCooking/fieldOptions';
import FieldShell from '@/components/field/FieldShell';
import styles from '../field.module.css';

export default function LeadsPage() {
  return <FieldShell title="My leads"><Leads /></FieldShell>;
}

function Leads() {
  const leads = useFieldLeads();
  if (leads.isLoading) return <p className={styles.empty}>Loading your leads…</p>;
  if (leads.isError) return <p className={styles.error}>{leads.error.message}</p>;

  const list = leads.data || [];
  const open = list.filter((l) => OPEN_LEAD_STAGES.includes(l.stage));
  const closed = list.filter((l) => !OPEN_LEAD_STAGES.includes(l.stage));
  const now = Date.now();

  const item = (l) => {
    const who = l.customerName || (l.customerType === 'institution' ? labelOf('institutionType', l.institutionType) : 'Customer');
    const overdue = l.followUpDate && new Date(l.followUpDate).getTime() < now && OPEN_LEAD_STAGES.includes(l.stage);
    return (
      <Link key={l.$id} href={`/field/leads/${l.$id}`} className={styles.listItem}>
        <strong>{who}</strong>
        <span className={styles.listMeta}>
          <span className={`${styles.chip} ${l.stage === 'closed_without_sale' ? styles.chipMuted : ''}`}>{labelOf('leadStage', l.stage)}</span>
          {l.followUpDate && OPEN_LEAD_STAGES.includes(l.stage) && (
            <span className={`${styles.chip} ${overdue ? styles.chipWarn : styles.chipMuted}`}>
              {overdue ? 'Overdue' : 'Follow up'} {new Date(l.followUpDate).toLocaleDateString('en-UG', { day: 'numeric', month: 'short' })}
            </span>
          )}
          {l.location && <span>{l.location}</span>}
        </span>
        {l.nextAction && OPEN_LEAD_STAGES.includes(l.stage) && <span className={styles.listMeta}>Next: {l.nextAction}</span>}
      </Link>
    );
  };

  return (
    <>
      <Link href="/field/leads/new" className={`${styles.primary} d-flex align-items-center justify-content-center text-decoration-none mb-3`}>
        <i className="bi bi-plus-lg me-2" />New lead
      </Link>
      <h1 className={styles.h1}>Open ({open.length})</h1>
      {open.length ? <div className={`${styles.list} mb-4`}>{open.map(item)}</div> : <p className={`${styles.empty} mb-4`}>No open leads. Record one after your next demonstration.</p>}
      {closed.length > 0 && (
        <>
          <h1 className={styles.h1}>Closed ({closed.length})</h1>
          <div className={styles.list}>{closed.map(item)}</div>
        </>
      )}
    </>
  );
}
