'use client';

import { Alert, Button, Spinner } from 'react-bootstrap';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useCleanCookingSummary } from '@/hooks/useCleanCooking';
import MetricCard from '@/components/ui/MetricCard';
import SectionCard from '@/components/ui/SectionCard';
import EmptyState from '@/components/ui/EmptyState';
import { FIELD_OPTIONS } from '@/lib/cleanCooking/fieldOptions';
import styles from './CleanCooking.module.css';

const LEAD_STAGES = FIELD_OPTIONS.leadStage;

const PRIMARY = '#054653';
const SECONDARY = '#14B8A6';
const fmt = (n) => Number(n || 0).toLocaleString('en-UG');

function QuantityTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #DBE7EC', borderRadius: 8, padding: '0.5rem 0.75rem', fontSize: 13 }}>
      <div style={{ fontWeight: 700 }}>{label || payload[0].payload.label}</div>
      <div>{fmt(payload[0].value)} EPCs</div>
    </div>
  );
}

function HorizontalBars({ data, labelKey, height }) {
  return (
    <div className={height === 'tall' ? styles.chartBoxTall : styles.chartBox}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }}>
          <CartesianGrid horizontal={false} stroke="#E6EEF1" />
          <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 12, fill: '#667982' }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey={labelKey} width={170} tick={{ fontSize: 12, fill: '#17262D' }} axisLine={false} tickLine={false} interval={0} />
          <Tooltip content={<QuantityTooltip />} cursor={{ fill: 'rgba(20,184,166,0.08)' }} />
          <Bar dataKey="quantity" radius={[0, 4, 4, 0]} maxBarSize={22}>
            {data.map((entry, index) => <Cell key={entry[labelKey]} fill={index === 0 ? PRIMARY : SECONDARY} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ColumnBars({ data, labelKey }) {
  return (
    <div className={styles.chartBox}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid vertical={false} stroke="#E6EEF1" />
          <XAxis dataKey={labelKey} tick={{ fontSize: 12, fill: '#17262D' }} axisLine={false} tickLine={false} interval={0} />
          <YAxis tickFormatter={fmt} tick={{ fontSize: 12, fill: '#667982' }} axisLine={false} tickLine={false} width={56} />
          <Tooltip content={<QuantityTooltip />} cursor={{ fill: 'rgba(20,184,166,0.08)' }} />
          <Bar dataKey="quantity" fill={SECONDARY} radius={[4, 4, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function CleanCookingDashboard({ projectId, onNavigate }) {
  const { data, isLoading, error } = useCleanCookingSummary(projectId);

  if (isLoading) return <div className="text-center py-5"><Spinner animation="border" /></div>;
  if (error) return <Alert variant="warning">{error.message}</Alert>;

  const { sales, companies, champions } = data;
  const top = sales.byCompany[0];
  const topShare = top && sales.totalQuantity ? Math.round((top.quantity / sales.totalQuantity) * 100) : 0;
  const maxDistrict = Math.max(1, ...champions.byDistrict.map((d) => d.champions));

  return (
    <div>
      <div className="row g-3 mb-3">
        <div className="col-sm-6 col-xl-3">
          <MetricCard label="EPCs sold" value={fmt(sales.totalQuantity)} hint={`${fmt(sales.recordCount)} records reported`} icon="bi-fire" />
        </div>
        <div className="col-sm-6 col-xl-3">
          <MetricCard label="Companies reporting" value={fmt(sales.companiesReporting)} hint={`${fmt(companies.active)} active companies listed`} icon="bi-building" />
        </div>
        <div className="col-sm-6 col-xl-3">
          <MetricCard label="Brands" value={fmt(sales.brandCount)} hint={top ? `Top seller: ${top.company} (${topShare}%)` : 'No sales yet'} icon="bi-tags" />
        </div>
        <div className="col-sm-6 col-xl-3">
          <MetricCard label="Active champions" value={fmt(champions.total)} hint={`${fmt(champions.byDistrict.length)} districts · ${fmt(champions.withContact)} with phone/email`} icon="bi-people" />
        </div>
      </div>

      {data.field && (
        <SectionCard
          title="Champion field work"
          description="From the champions portal. Only verified sales count as programme results."
          action={<Button size="sm" className={styles.secondaryButton} onClick={() => onNavigate('field')}>Open field reports</Button>}
          className="mb-3"
        >
          <div className="row g-3">
            <div className="col-sm-6 col-xl-3">
              <MetricCard
                label="Champion EPC sales"
                value={`${fmt(data.field.sales.verifiedQuantity)} verified`}
                hint={`${fmt(data.field.sales.submittedQuantity)} reported · ${fmt(data.field.sales.awaitingReview)} awaiting review`}
                icon="bi-cart-check"
              />
            </div>
            <div className="col-sm-6 col-xl-3">
              <MetricCard label="Leads" value={fmt(data.field.leads.total)} hint={`${fmt(data.field.leads.converted)} converted to sales`} icon="bi-person-plus" />
            </div>
            <div className="col-sm-6 col-xl-3">
              <MetricCard
                label="Lead conversion"
                value={data.field.leads.conversionRate === null ? '—' : `${Math.round(data.field.leads.conversionRate * 100)}%`}
                hint="Leads that became a sale"
                icon="bi-funnel"
              />
            </div>
            <div className="col-sm-6 col-xl-3">
              <MetricCard
                label="Still using the EPC"
                value={data.field.adoption.inUseRate === null ? '—' : `${Math.round(data.field.adoption.inUseRate * 100)}%`}
                hint={`of ${fmt(data.field.adoption.customersReached)} customers followed up`}
                icon="bi-heart-pulse"
              />
            </div>
          </div>
          {data.field.leads.total > 0 && (
            <div className="mt-3">
              <div className="small fw-bold text-muted text-uppercase mb-2">Leads by stage</div>
              <div className="d-flex flex-wrap gap-2">
                {LEAD_STAGES.map((s) => (
                  <span key={s.value} className={`${styles.pill} ${s.value === 'closed_without_sale' ? styles.pillMuted : ''}`}>
                    {s.label}: <strong className="ms-1">{fmt(data.field.leads.byStage[s.value] || 0)}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}
        </SectionCard>
      )}

      {sales.totalQuantity === 0 ? (
        <SectionCard>
          <EmptyState
            icon="bi-receipt"
            title="No company sales yet"
            text="Import the EPC sales spreadsheet or add records one by one."
            action={<Button className={styles.primaryButton} onClick={() => onNavigate('sales')}>Go to Company sales</Button>}
          />
        </SectionCard>
      ) : (
        <>
          <div className={`${styles.chartGrid} mb-3`}>
            <SectionCard title="EPCs sold by company" description="Total units across all reporting periods.">
              <HorizontalBars data={sales.byCompany} labelKey="company" height={sales.byCompany.length > 10 ? 'tall' : 'normal'} />
            </SectionCard>
            <SectionCard title="EPCs sold by brand" description="Spelling variants of a brand are merged on entry.">
              <HorizontalBars data={sales.byBrand} labelKey="brand" height={sales.byBrand.length > 10 ? 'tall' : 'normal'} />
            </SectionCard>
          </div>
          <div className={`${styles.chartGrid} mb-3`}>
            <SectionCard title="By cooker size" description="Litres capacity.">
              <ColumnBars data={sales.bySize} labelKey="size" />
            </SectionCard>
            <SectionCard title="By reporting period" description="Periods are as reported by companies and may differ in length.">
              <ColumnBars data={sales.byPeriod} labelKey="period" />
            </SectionCard>
          </div>
        </>
      )}

      <SectionCard
        title="Champions by district"
        description="Active champions, and how many can be reached by phone or email."
        action={<Button size="sm" className={styles.secondaryButton} onClick={() => onNavigate('champions')}>Manage champions</Button>}
        flush
      >
        {champions.byDistrict.length === 0 ? (
          <EmptyState icon="bi-people" title="No champions yet" text="Add champions and the district each one works in." />
        ) : (
          <div className={styles.tableWrap}>
            <table className={`table ${styles.table}`}>
              <thead>
                <tr><th>District</th><th className={styles.num}>Champions</th><th className={styles.num}>Reachable</th><th style={{ width: '40%' }} /></tr>
              </thead>
              <tbody>
                {champions.byDistrict.map((d) => (
                  <tr key={d.district}>
                    <td className={styles.strong}>{d.district}</td>
                    <td className={styles.num}>{d.champions}</td>
                    <td className={styles.num}>{d.reachable}</td>
                    <td>
                      <div className={styles.barTrack}><div className={styles.barFill} style={{ width: `${(d.champions / maxDistrict) * 100}%` }} /></div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
