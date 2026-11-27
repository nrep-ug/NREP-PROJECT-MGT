'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Alert, Button, Spinner } from 'react-bootstrap';
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useCleanCookingMarketFigures, useCleanCookingSummary } from '@/hooks/useCleanCooking';
import { epcSalesSeries, marketLabel } from '@/lib/cleanCooking/marketDomain';
import { ACCESS_RADIUS_KM, MAP_SITES, overlappingSites, sitesBySettlement } from '@/lib/cleanCooking/mapSites';
import { TRAINING_SOURCE, summarizeTraining, trainingChartRows } from '@/lib/cleanCooking/trainingFigures';
import MetricCard from '@/components/ui/MetricCard';
import SectionCard from '@/components/ui/SectionCard';
import EmptyState from '@/components/ui/EmptyState';
import { FIELD_OPTIONS } from '@/lib/cleanCooking/fieldOptions';
import styles from './CleanCooking.module.css';

const LEAD_STAGES = FIELD_OPTIONS.leadStage;

const PRIMARY = '#054653';
const SECONDARY = '#14B8A6';
// Training chart: blue = trained by NREP, green = trained by champions (ToTs).
const TRAINED_BLUE = '#1F6FB2';
const TRAINED_GREEN = '#16A34A';
const fmt = (n) => Number(n || 0).toLocaleString('en-UG');

// Leaflet touches `window`, so the maps load in the browser only.
const SitesMap = dynamic(() => import('./SitesMap'), {
  ssr: false,
  loading: () => <div className={styles.mapBox} style={{ display: 'grid', placeItems: 'center' }}><Spinner animation="border" size="sm" /></div>,
});

const SETTLEMENTS = sitesBySettlement(MAP_SITES);
const OVERLAPS = overlappingSites(MAP_SITES, ACCESS_RADIUS_KM);
const TRAINING = summarizeTraining();
const TRAINING_ROWS = trainingChartRows();

function TrainingTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div style={{ background: '#fff', border: '1px solid #DBE7EC', borderRadius: 8, padding: '0.5rem 0.75rem', fontSize: 13 }}>
      <div style={{ fontWeight: 700 }}>{label}</div>
      <div>Trained by NREP (ToTs): {fmt(row.trainedByNrep)}</div>
      <div>Trained by champions: {row.trainedByTots ? fmt(row.trainedByTots) : 'none reported yet'}</div>
    </div>
  );
}

function TrainingChart() {
  return (
    <div className={styles.chartBoxTall}>
      <ResponsiveContainer>
        <BarChart data={TRAINING_ROWS} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }}>
          <CartesianGrid horizontal={false} stroke="#E6EEF1" />
          <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 12, fill: '#667982' }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="location" width={90} tick={{ fontSize: 12, fill: '#17262D' }} axisLine={false} tickLine={false} interval={0} />
          <Tooltip content={<TrainingTooltip />} cursor={{ fill: 'rgba(31,111,178,0.06)' }} />
          <Legend verticalAlign="top" align="left" iconType="square" wrapperStyle={{ fontSize: 13, paddingBottom: 8 }} />
          <Bar dataKey="trainedByNrep" name="Trained by NREP (ToTs)" stackId="t" fill={TRAINED_BLUE} stroke={TRAINED_BLUE} maxBarSize={22} />
          <Bar dataKey="trainedByTots" name="Trained by champions, not NREP" stackId="t" fill={TRAINED_GREEN} stroke={TRAINED_GREEN} radius={[0, 4, 4, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function QuantityTooltip({ active, payload, label, unit = 'EPCs' }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #DBE7EC', borderRadius: 8, padding: '0.5rem 0.75rem', fontSize: 13 }}>
      <div style={{ fontWeight: 700 }}>{label || payload[0].payload.label}</div>
      <div>{fmt(payload[0].value)} {unit}</div>
    </div>
  );
}

function HorizontalBars({ data, labelKey, height, unit }) {
  return (
    <div className={height === 'tall' ? styles.chartBoxTall : styles.chartBox}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }}>
          <CartesianGrid horizontal={false} stroke="#E6EEF1" />
          <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 12, fill: '#667982' }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey={labelKey} width={170} tick={{ fontSize: 12, fill: '#17262D' }} axisLine={false} tickLine={false} interval={0} />
          <Tooltip content={<QuantityTooltip unit={unit} />} cursor={{ fill: 'rgba(20,184,166,0.08)' }} />
          <Bar dataKey="quantity" radius={[0, 4, 4, 0]} maxBarSize={22}>
            {data.map((entry, index) => <Cell key={entry[labelKey]} fill={index === 0 ? PRIMARY : SECONDARY} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ColumnBars({ data, labelKey }) {
  // Many bars (e.g. 14 months): tilt the labels so they don't run together.
  const crowded = data.length > 8;
  return (
    <div className={styles.chartBox}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: crowded ? 8 : 4, left: 0 }}>
          <CartesianGrid vertical={false} stroke="#E6EEF1" />
          <XAxis
            dataKey={labelKey}
            tick={{ fontSize: crowded ? 11 : 12, fill: '#17262D' }}
            axisLine={false}
            tickLine={false}
            interval={0}
            angle={crowded ? -40 : 0}
            textAnchor={crowded ? 'end' : 'middle'}
            height={crowded ? 56 : 30}
          />
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
  const market = useCleanCookingMarketFigures(projectId);
  const [settlement, setSettlement] = useState(SETTLEMENTS[0]?.settlement);

  if (isLoading) return <div className="text-center py-5"><Spinner animation="border" /></div>;
  if (error) return <Alert variant="warning">{error.message}</Alert>;

  const { sales, champions } = data;
  const maxDistrict = Math.max(1, ...champions.byDistrict.map((d) => d.champions));
  const figures = market.data?.figures || [];
  const epcSales = epcSalesSeries(figures);
  const companyCheck = market.data?.summary?.company_market_total;
  // Other clean cooking technologies sold (same event records, products other than EPCs).
  const otherTech = Object.entries(market.data?.summary?.event_product_count?.byProduct || {})
    .filter(([product]) => product !== 'epc')
    .map(([product, quantity]) => ({ product: marketLabel('product', product), quantity }))
    .sort((a, b) => b.quantity - a.quantity);
  const otherTechTotal = otherTech.reduce((n, t) => n + t.quantity, 0);
  const span = epcSales.firstDate ? `${new Date(epcSales.firstDate).toLocaleDateString('en-UG', { month: 'short', year: 'numeric' })} – ${new Date(epcSales.lastDate).toLocaleDateString('en-UG', { month: 'short', year: 'numeric' })}` : '';

  return (
    <div>
      <div className="row g-3 mb-3">
        <div className="col-sm-6 col-xl-3">
          <MetricCard tone="teal" label="EPCs sold" value={market.isLoading ? '…' : fmt(epcSales.total)} hint={epcSales.total ? `Phase 1 · ${span} · ${fmt(epcSales.events)} events` : 'No sales recorded yet'} icon="bi-fire" />
        </div>
        <div className="col-sm-6 col-xl-3">
          <MetricCard
            tone="green"
            label="Company totals (cross-check)"
            value={companyCheck ? fmt(companyCheck.epc) : '…'}
            hint="Kiboko & Digi Wave at 25%"
            icon="bi-check2-all"
          />
        </div>
        <div className="col-sm-6 col-xl-3">
          <MetricCard tone="blue" label="Brand & size detail" value={fmt(sales.totalQuantity)} hint={`${fmt(sales.companiesReporting)} companies itemised · ${fmt(sales.brandCount)} brands`} icon="bi-tags" />
        </div>
        <div className="col-sm-6 col-xl-3">
          <MetricCard label="Active champions" value={fmt(champions.total)} hint={`${fmt(champions.byDistrict.length)} districts · ${fmt(champions.withContact)} with phone/email`} icon="bi-people" />
        </div>
      </div>

      <div className={`${styles.chartGrid} mb-3`}>
        <SectionCard
          title="Where the sites are"
          description={`${MAP_SITES.length} sites in ${SETTLEMENTS.map((g) => g.settlement).join(' and ')}. Click a point for its details.`}
        >
          <SitesMap sites={MAP_SITES} mode="points" />
          <div className="mt-2">
            <div className="small fw-bold text-muted text-uppercase mb-1">Community engagements held</div>
            <ul className="list-unstyled small mb-0">
              {MAP_SITES.map((s) => (
                <li key={s.id} className="d-flex flex-wrap align-items-center gap-1 mb-1">
                  <span className="fw-semibold me-1">{s.name.split(' (')[0]}:</span>
                  {s.engagements.length
                    ? s.engagements.map((e) => <span key={e} className={styles.pill}>{e}</span>)
                    : <span className="text-muted">not reported yet</span>}
                </li>
              ))}
            </ul>
          </div>
        </SectionCard>
        <SectionCard
          title={`Who can reach each site (${ACCESS_RADIUS_KM} km)`}
          description={`Each circle is a ${ACCESS_RADIUS_KM} km radius: the host and refugee communities within reach of the site and its services.`}
        >
          <div className="d-flex flex-wrap gap-2 mb-2" role="group" aria-label="Choose settlement">
            {SETTLEMENTS.map((g) => (
              <button
                key={g.settlement}
                type="button"
                className={`${styles.pill} ${settlement === g.settlement ? '' : styles.pillMuted} border-0`}
                aria-pressed={settlement === g.settlement}
                onClick={() => setSettlement(g.settlement)}
              >
                {g.settlement} ({g.sites.length})
              </button>
            ))}
          </div>
          <SitesMap
            sites={MAP_SITES}
            mode="radius"
            radiusKm={ACCESS_RADIUS_KM}
            focus={SETTLEMENTS.find((g) => g.settlement === settlement)?.sites.map((s) => s.id)}
          />
          {OVERLAPS.length > 0 && (
            <p className="small text-muted mt-2 mb-0">
              Overlapping areas (households in between can reach either site): {OVERLAPS.map((o) => `${MAP_SITES.find((x) => x.id === o.a).name.split(' (')[0]}–${MAP_SITES.find((x) => x.id === o.b).name.split(' (')[0]} ${o.km} km apart`).join(' · ')}.
            </p>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Clean cooking champions trained"
        description={`Blue: champions trained directly by NREP (ToTs). Green: people those champions went on to train, not trained by NREP. Source: ${TRAINING_SOURCE}; reported, not yet verified.`}
        action={<Button size="sm" className={styles.secondaryButton} onClick={() => onNavigate('champions')}>Manage champions</Button>}
        className="mb-3"
      >
        <div className="row g-3 mb-3">
          <div className="col-sm-6 col-xl-3">
            <MetricCard tone="blue" label="Trained by NREP" value={fmt(TRAINING.trainedByNrep)} hint={`ToTs in ${fmt(TRAINING.locations)} locations`} icon="bi-mortarboard" />
          </div>
          <div className="col-sm-6 col-xl-3">
            <MetricCard tone="teal" label="Trained by champions" value={fmt(TRAINING.trainedByTots)} hint="Community members, not trained by NREP" icon="bi-people" />
          </div>
          <div className="col-sm-6 col-xl-3">
            <MetricCard tone="green" label="Locations where ToTs are training" value={`${fmt(TRAINING.activeLocations)} of ${fmt(TRAINING.locations)}`} hint={`${Math.round((TRAINING.activeShare || 0) * 100)}% active`} icon="bi-graph-up-arrow" />
          </div>
          <div className="col-sm-6 col-xl-3">
            <MetricCard label="Community trainings held" value={fmt(TRAINING.trainings)} hint="So far, November 2026" icon="bi-calendar-check" />
          </div>
        </div>
        <TrainingChart />
      </SectionCard>

      {epcSales.total > 0 && (
        <>
          {otherTechTotal > 0 && (
            <SectionCard
              title={`Other clean cooking technologies sold: ${fmt(otherTechTotal)}`}
              description="Recorded at the same events as the EPC sales (Phase 1). Counted separately from EPCs."
              className="mb-3"
            >
              <HorizontalBars data={otherTech} labelKey="product" unit="units" />
            </SectionCard>
          )}
          <SectionCard
            title="EPCs sold by district"
            description="Where the sales were recorded."
            action={<Button size="sm" className={styles.secondaryButton} onClick={() => onNavigate('figures')}>All sales figures</Button>}
            className="mb-3"
          >
            <HorizontalBars data={epcSales.byDistrict} labelKey="district" height={epcSales.byDistrict.length > 10 ? 'tall' : 'normal'} />
          </SectionCard>
        </>
      )}

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
            <SectionCard title="Brand & size detail: by company" description={`Itemised reports from ${fmt(sales.companiesReporting)} companies (${fmt(sales.totalQuantity)} EPCs). A breakdown, not the EPCs-sold total.`}>
              <HorizontalBars data={sales.byCompany} labelKey="company" height={sales.byCompany.length > 10 ? 'tall' : 'normal'} />
            </SectionCard>
            <SectionCard title="Brand & size detail: by brand" description="From the same itemised reports. Spelling variants of a brand are merged on entry.">
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
