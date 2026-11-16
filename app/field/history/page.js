'use client';

import Link from 'next/link';
import { useFieldSales } from '@/hooks/useField';
import { labelOf } from '@/lib/cleanCooking/fieldOptions';
import FieldShell from '@/components/field/FieldShell';
import styles from '../field.module.css';

export default function HistoryPage() {
  return <FieldShell title="My sales"><History /></FieldShell>;
}

const TONE = { verified: '', submitted: 'chipMuted', needs_review: 'chipWarn', rejected: 'chipWarn' };

function History() {
  const sales = useFieldSales();
  if (sales.isLoading) return <p className={styles.empty}>Loading…</p>;
  if (sales.isError) return <p className={styles.error}>{sales.error.message}</p>;
  const list = sales.data || [];
  const total = list.filter((s) => s.verificationStatus !== 'rejected').reduce((n, s) => n + s.quantity, 0);
  const verified = list.filter((s) => s.verificationStatus === 'verified').reduce((n, s) => n + s.quantity, 0);

  return (
    <>
      <section className={`${styles.card} ${styles.hero}`}>
        <div className={styles.stats}>
          <div className={styles.stat}><strong>{total}</strong><span>EPCs reported</span></div>
          <div className={styles.stat}><strong>{verified}</strong><span>Verified by NREP</span></div>
          <div className={styles.stat}><strong>{list.filter((s) => s.verificationStatus === 'needs_review').length}</strong><span>Need your attention</span></div>
        </div>
      </section>
      {list.length === 0 ? (
        <p className={styles.empty}>No sales yet. <Link href="/field/sales/new">Record your first sale</Link>.</p>
      ) : (
        <div className={styles.list}>
          {list.map((s) => (
            <div key={s.$id} className={styles.listItem}>
              <strong>{s.quantity} × {s.brand}{s.sizeLitres ? ` ${s.sizeLitres}L` : ''}</strong>
              <span className={styles.listMeta}>
                <span className={`${styles.chip} ${styles[TONE[s.verificationStatus]] || ''}`}>{labelOf('verificationStatus', s.verificationStatus)}</span>
                <span>{new Date(s.saleDate).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                <span>{s.customerName || (s.customerType === 'institution' ? labelOf('institutionType', s.institutionType) : 'Customer')}</span>
              </span>
              {s.verificationNote && s.verificationStatus !== 'verified' && (
                <p className={`${styles.warning} mt-2 mb-0`}><strong>NREP:</strong> {s.verificationNote}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
