'use client';

import { useMemo, useState } from 'react';
import { Alert, Spinner } from 'react-bootstrap';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useCleanCookingMarketFigures, useCleanCookingSummary } from '@/hooks/useCleanCooking';
import MetricCard from '@/components/ui/MetricCard';
import SectionCard from '@/components/ui/SectionCard';
import EmptyState from '@/components/ui/EmptyState';
import { marketLabel } from '@/lib/cleanCooking/marketDomain';
import styles from './CleanCooking.module.css';

const fmt = (n) => Number(n || 0).toLocaleString('en-UG');
const day = (iso) => (iso ? new Date(iso).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const EVENT_PRODUCTS = ['epc', 'briquettes', 'improved_cookstove', 'lpg', 'pressure_cooker', 'volcanic_rock_stove', 'kitchen_eware_other'];
const SHORT = { epc: 'EPC', briquettes: 'Briquettes', improved_cookstove: 'ICS', lpg: 'LPG', pressure_cooker: 'Pressure', volcanic_rock_stove: 'Volcanic', kitchen_eware_other: 'Other' };
const TABLES = [
  { key: 'company_market_total', label: 'Company-wide totals' },
  { key: 'event_product_count', label: 'EPC sales by event' },
];

function NoteFlag({ text }) {
  if (!text) return null;
  return <i className="bi bi-exclamation-circle text-warning ms-1" title={text} aria-label={text} />;
}

function CompanyTotals({ rows }) {
  return (
    <div className={styles.tableWrap}>
      <table className={`table table-hover ${styles.table}`}>
        <thead><tr><th>Company</th><th>Period</th><th className={styles.num}>EPCs reported</th><th className={styles.num}>Counts for BCCeC</th><th>Status</th></tr></thead>
        <tbody>
          {[...rows].sort((a, b) => (b.quantity ?? -1) - (a.quantity ?? -1)).map((r) => (
            <tr key={r.$id}>
              <td className={styles.strong}>{r.companyName}<NoteFlag text={r.notes} /></td>
              <td>{r.periodLabel || '—'}</td>
              <td className={styles.num}>{r.quantity === null || r.quantity === undefined ? <span className={styles.muted}>Not reported</span> : fmt(r.quantity)}</td>
              <td className={`${styles.num} ${styles.strong}`}>
                {r.quantity === null || r.quantity === undefined ? '—' : fmt(r.attributedQuantity ?? r.quantity)}
                {r.attributionRate < 1 && <span className={`${styles.pill} ms-2`}>{Math.round(r.attributionRate * 100)}%</span>}
              </td>
              <td><span className={`${styles.pill} ${styles.pillMuted}`}>{marketLabel('verificationStatus', r.verificationStatus)}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EventCounts({ rows }) {
  // One table row per source event (all products side by side).
  const events = useMemo(() => {
    const byEvent = new Map();
    for (const r of rows) {
      const key = `${r.sourceSheet}|${r.sourceRow}`;
      if (!byEvent.has(key)) byEvent.set(key, { key, date: r.eventDate, district: r.district, subLocation: r.subLocation, notes: new Set(), q: {} });
      const e = byEvent.get(key);
      e.q[r.product] = r.quantity;
      if (r.notes) e.notes.add(r.notes);
    }
    return [...byEvent.values()].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }, [rows]);
  const byMonth = useMemo(() => {
    const m = new Map();
    for (const r of rows) if (r.product === 'epc' && r.eventDate) {
      const k = r.eventDate.slice(0, 7);
      m.set(k, (m.get(k) || 0) + (r.quantity || 0));
    }
    return [...m.entries()].sort().map(([k, v]) => ({ month: new Date(`${k}-01T00:00:00Z`).toLocaleDateString('en-UG', { month: 'short', year: '2-digit' }), quantity: v }));
  }, [rows]);

  return (
    <>
      <div className={styles.chartBox}>
        <ResponsiveContainer>
          <BarChart data={byMonth} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid vertical={false} stroke="#E6EEF1" />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#17262D' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={fmt} tick={{ fontSize: 12, fill: '#667982' }} axisLine={false} tickLine={false} width={56} />
            <Tooltip formatter={(v) => [`${fmt(v)} EPCs`, 'Counted at events']} cursor={{ fill: 'rgba(20,184,166,0.08)' }} />
            <Bar dataKey="quantity" fill="#0F766E" radius={[4, 4, 0, 0]} maxBarSize={44} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className={styles.tableWrap}>
        <table className={`table table-hover ${styles.table}`}>
          <thead>
            <tr><th>Date</th><th>District</th>{EVENT_PRODUCTS.map((p) => <th key={p} className={styles.num}>{SHORT[p]}</th>)}</tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.key}>
                <td className="text-nowrap">{day(e.date)}</td>
                <td>{e.district || '—'}{e.subLocation && <span className="small text-muted"> · {e.subLocation}</span>}<NoteFlag text={[...e.notes].join(' ')} /></td>
                {EVENT_PRODUCTS.map((p) => (
                  <td key={p} className={`${styles.num} ${p === 'epc' ? styles.strong : ''}`}>
                    {e.q[p] === undefined ? '0' : e.q[p] === null ? <span className={styles.muted} title="Not reported">–</span> : fmt(e.q[p])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/**
 * Clean Cooking → Sales figures. Every source is shown on its own: they
 * measure different things (company reports, event counts, verified champion
 * sales) and are never added together. EPCs distributed by NREP are not
 * shown: they are already included in the company sales.
 */
export default function MarketFiguresPanel({ projectId }) {
  const market = useCleanCookingMarketFigures(projectId);
  const summary = useCleanCookingSummary(projectId);
  const [table, setTable] = useState('company_market_total');

  if (market.isLoading) return <div className="text-center py-5"><Spinner animation="border" /></div>;
  if (market.error) return <Alert variant="warning">{market.error.message}</Alert>;

  const { figures, summary: s, notes, notDeployed } = market.data;
  const companySales = summary.data?.sales?.totalQuantity;
  const champion = summary.data?.field?.sales;
  const rows = figures.filter((f) => f.figureType === table);
  const events = new Set(figures.filter((f) => f.figureType === 'event_product_count').map((f) => f.sourceRow)).size;

  return (
    <>
      {notDeployed && (
        <Alert variant="info">
          The sales figures table has not been created yet. An administrator needs to run <code>npm run schema:clean-cooking -- --apply</code> once.
        </Alert>
      )}
      <Alert variant="light" className="border small">
        <i className="bi bi-info-circle me-1" />
        <strong>EPCs sold</strong> is the Phase 1 headline figure. The company totals cross-check it and the brand &amp; size detail breaks part of it down,
        so these figures are <strong>never added together</strong>. All are unverified until M&amp;E reviews them.
      </Alert>

      <div className="row g-3 mb-3">
        <div className="col-sm-6 col-xl">
          <MetricCard tone="teal" label="EPCs sold" value={fmt(s.event_product_count.epc)} hint={`Phase 1 · recorded at ${events} events`} icon="bi-fire" />
        </div>
        <div className="col-sm-6 col-xl">
          <MetricCard tone="green" label="Company totals (cross-check)" value={fmt(s.company_market_total.epc)} hint={`of ${fmt(s.company_market_total.epcReported)} reported · Kiboko & Digi Wave at 25% · 2025/26`} icon="bi-buildings" />
        </div>
        <div className="col-sm-6 col-xl">
          <MetricCard tone="blue" label="Brand & size detail" value={companySales === undefined ? '…' : fmt(companySales)} hint="19 companies itemised · used for brand and size charts" icon="bi-tags" />
        </div>
        <div className="col-sm-6 col-xl">
          <MetricCard tone="green" label="Champion sales verified" value={champion ? fmt(champion.verifiedQuantity) : '…'} hint="From the champions portal" icon="bi-patch-check" />
        </div>
      </div>

      <SectionCard
        title="Where the figures come from"
        description={notes[table]}
        action={(
          <nav className={styles.subnav} aria-label="Sales figure sources">
            {TABLES.map((t) => (
              <button key={t.key} type="button" className={`${styles.subnavButton} ${table === t.key ? styles.subnavActive : ''}`} aria-current={table === t.key ? 'true' : undefined} onClick={() => setTable(t.key)}>
                {t.label}
              </button>
            ))}
          </nav>
        )}
        flush
      >
        {rows.length === 0 ? (
          <EmptyState icon="bi-inboxes" title="Nothing here yet" text="These figures appear once the Phase 1 sales data is imported." />
        ) : table === 'company_market_total' ? <CompanyTotals rows={rows} />
          : <EventCounts rows={rows} />}
      </SectionCard>
    </>
  );
}
