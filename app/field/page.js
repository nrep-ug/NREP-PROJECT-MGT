'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { authenticatedFetch } from '@/lib/apiClient';
import { useFieldSummary } from '@/hooks/useField';
import FieldShell from '@/components/field/FieldShell';
import styles from './field.module.css';

/** Champions portal home (/field). Phone-first, no staff navigation. */
export default function FieldHome() {
  return (
    <FieldShell back={null}>
      <Home />
    </FieldShell>
  );
}

function Home() {
  const me = useQuery({
    queryKey: ['field', 'me'],
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    queryFn: async () => {
      const response = await authenticatedFetch('/api/field/me');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Your details could not be loaded.');
      return data;
    },
  });
  const summary = useFieldSummary();
  const counts = summary.data?.counts;

  if (me.isError) {
    return (
      <section className={styles.card}>
        <h1 className={styles.title}>We couldn’t load your details</h1>
        <p className={styles.muted}>{me.error.message}</p>
        <button type="button" className={styles.primary} onClick={() => me.refetch()}>Try again</button>
      </section>
    );
  }

  const tiles = [
    { href: '/field/sales/new', icon: 'bi-cart-check', label: 'Record a sale', sub: 'An EPC was bought' },
    { href: '/field/leads/new', icon: 'bi-person-plus', label: 'New lead', sub: 'Someone is interested' },
    { href: '/field/leads', icon: 'bi-people', label: 'My leads', sub: counts ? `${counts.openLeads} open` : '…', badge: counts?.leadsDueToday },
    { href: '/field/followups', icon: 'bi-telephone-forward', label: 'Follow-ups', sub: counts ? `${counts.followUpsDue} due` : '…', badge: counts?.followUpsDue },
  ];

  return (
    <>
      <section className={`${styles.card} ${styles.hero}`}>
        <p className={styles.eyebrow}>{me.data ? `${me.data.project.code} · ${me.data.district} district` : 'Loading…'}</p>
        <h1 className={styles.title}>{me.data ? `Hello, ${me.data.fullName.split(' ')[0]}` : 'Hello'}</h1>
        {me.data && (
          <p className={styles.heroText}>
            Clean Cooking champion for <strong>{me.data.district}</strong>{me.data.isDistrictLead ? ' · District lead' : ''}
          </p>
        )}
        {counts && (
          <div className={styles.stats}>
            <div className={styles.stat}><strong>{counts.salesThisMonth}</strong><span>EPCs sold this month</span></div>
            <div className={styles.stat}><strong>{counts.openLeads}</strong><span>Open leads</span></div>
            <div className={styles.stat}><strong>{counts.followUpsDone}</strong><span>Follow-ups done</span></div>
          </div>
        )}
      </section>

      <section className={styles.grid} aria-label="What would you like to do?">
        {tiles.map((t) => (
          <Link key={t.href} href={t.href} className={styles.tileLink}>
            <i className={`bi ${t.icon}`} aria-hidden="true" />
            <span>{t.label}{t.badge ? <b className={styles.badge}>{t.badge}</b> : null}</span>
            <small>{t.sub}</small>
          </Link>
        ))}
      </section>

      <Link href="/field/history" className={styles.listItem}>
        <strong><i className="bi bi-journal-text me-2" aria-hidden="true" />My sales & their status</strong>
        <span className={styles.listMeta}>See which sales NREP has verified{counts ? ` · ${counts.salesTotal} EPCs reported in total` : ''}</span>
      </Link>
      {summary.isError && <p className={styles.footnote}>Counts couldn’t load: {summary.error.message}</p>}
    </>
  );
}
