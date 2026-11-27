/**
 * Market & sales figures that are NOT itemised company sales (those live in
 * cc_company_sales). Each figure type is a different measure and is never
 * added to another:
 *
 *   company_market_total  — a company's total EPC sales for a period as the
 *                           company reported it (e.g. "EPC SALES DATA
 *                           2025/2026"); likely market-wide, unverified.
 *   event_product_count   — products counted at an exhibition / outreach
 *                           ("Private Sector Data"); unit pending M&E.
 *
 * EPCs distributed by NREP are NOT recorded here: they are already included
 * in the companies' sales (project lead decision, 21 Nov 2026).
 *
 * Pure functions; unit tested in tests/cleanCookingMarketDomain.test.cjs.
 */

const { cleanText } = require('./domain');

const opt = (value, label) => ({ value, label });

const MARKET_OPTIONS = {
  figureType: [
    opt('company_market_total', 'Company-wide sales reported by companies'),
    opt('event_product_count', 'EPC sales recorded by event'),
  ],
  product: [
    opt('epc', 'Electric pressure cooker (EPC)'),
    opt('briquettes', 'Briquettes'),
    opt('improved_cookstove', 'Improved cookstove'),
    opt('lpg', 'LPG'),
    opt('pressure_cooker', 'Pressure cooker (non-electric)'),
    opt('volcanic_rock_stove', 'Volcanic rock stove'),
    opt('solar_aided_stove', 'Solar-aided stove'),
    opt('induction_cooker', 'Induction cooker'),
    opt('kitchen_eware_other', 'Other kitchen e-ware'),
  ],
  verificationStatus: [
    opt('unverified', 'Unverified'),
    opt('verified', 'Verified'),
    opt('queried', 'Queried'),
    opt('rejected', 'Rejected'),
  ],
};

const marketValues = (key) => MARKET_OPTIONS[key].map((o) => o.value);
const marketLabel = (key, value) => MARKET_OPTIONS[key]?.find((o) => o.value === value)?.label || value || '—';

/** What each figure type means, shown next to its numbers. */
const FIGURE_NOTES = {
  company_market_total: 'Totals companies reported for 2025/26. Each company counts in full except Kiboko and Digi Wave, which count at 25% (business rule). The reported figures are kept unchanged. Not verified.',
  event_product_count: 'Sales recorded per event and district in the BCCeC master tracker (Jan 2025 – Feb 2026). This is the headline "EPCs sold" figure for Phase 1. Not yet verified by M&E.',
};

/**
 * Share of a company's reported sales that counts for BCCeC. Business rule
 * (project lead, 21 Nov 2026): Kiboko and Digi Wave count at 25%; every
 * other company counts in full. The reported figure is always kept as-is;
 * the attributed figure is stored next to it, never instead of it.
 */
const ATTRIBUTION_RULES = [
  { match: 'kiboko', rate: 0.25 },
  { match: 'digiwave', rate: 0.25 },
];
const companyKey = (name) => cleanText(name).toLowerCase().replace(/[^a-z0-9]/g, '');
function attributionFor(companyName, quantity) {
  const key = companyKey(companyName);
  const rule = ATTRIBUTION_RULES.find((r) => key.startsWith(r.match));
  const rate = rule ? rule.rate : 1;
  return {
    attributionRate: rate,
    attributedQuantity: quantity === null || quantity === undefined ? null : Math.round(quantity * rate),
  };
}

// District spellings found in the tracker → the district, plus the place
// itself kept as a sub-location. Region names are normalised too.
const DISTRICT_ALIASES = {
  fortportal: ['Fort Portal', null],
  'fort portal': ['Fort Portal', null],
  'bushenyi (ishaka)': ['Bushenyi', 'Ishaka'],
  nakivale: ['Isingiro', 'Nakivale'],
  'kamwenge (rwamwanja)': ['Kamwenge', 'Rwamwanja'],
  entebbe: ['Wakiso', 'Entebbe'],
  buruuli: ['Nakasongola', 'Buruuli'],
  sembabule: ['Ssembabule', null],
  luwero: ['Luweero', null],
  'masaka nyendo': ['Masaka', 'Nyendo'],
  'masaka central': ['Masaka', 'Masaka Central'],
  'lira city': ['Lira', 'Lira City'],
};
const REGION_ALIASES = { east: 'Eastern', west: 'Western', north: 'Northern', central: 'Central', 'west nile': 'West Nile' };

const titleCase = (s) => s.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase());

function normalizeDistrict(raw) {
  const text = cleanText(raw, 160);
  if (!text) return { district: null, subLocation: null, districtRaw: null };
  const alias = DISTRICT_ALIASES[text.toLowerCase()];
  if (alias) return { district: alias[0], subLocation: alias[1], districtRaw: text };
  return { district: titleCase(text), subLocation: null, districtRaw: text };
}

function normalizeRegion(raw) {
  const text = cleanText(raw, 40).toLowerCase();
  if (!text) return null;
  return REGION_ALIASES[text] || titleCase(text);
}

/** Whole number ≥ 0, or null when the cell was blank ("not reported" ≠ 0). */
function quantityOrNull(raw) {
  if (raw === null || raw === undefined || String(raw).trim() === '') return null;
  const text = String(raw).replace(/,/g, '').trim().replace(/\.0+$/, '');
  if (!/^\d+$/.test(text)) throw new Error(`"${raw}" is not a whole number`);
  return Number(text);
}

/**
 * Summary for the Sales figures view: totals per figure type and product,
 * never combined across types. Rejected rows are excluded; blanks are not 0.
 */
function summarizeMarketFigures(figures = []) {
  const live = figures.filter((f) => f.verificationStatus !== 'rejected');
  const byType = {};
  for (const type of marketValues('figureType')) {
    const rows = live.filter((f) => f.figureType === type);
    const byProduct = {};
    let reported = 0;
    for (const r of rows) {
      if (r.quantity === null || r.quantity === undefined) continue;
      // Counted figure: the attributed share when a rule applies, else the reported one.
      const counted = r.attributedQuantity ?? r.quantity;
      byProduct[r.product] = (byProduct[r.product] || 0) + counted;
      if (r.product === 'epc') reported += r.quantity;
    }
    const companies = new Set(rows.map((r) => r.companyName).filter(Boolean));
    const districts = new Set(rows.map((r) => r.district).filter(Boolean));
    byType[type] = {
      records: rows.length,
      epc: byProduct.epc || 0,
      epcReported: reported,
      partlyAttributed: rows.filter((r) => r.attributionRate !== undefined && r.attributionRate !== null && r.attributionRate < 1).map((r) => r.companyName),
      byProduct,
      notReported: rows.filter((r) => r.quantity === null || r.quantity === undefined).length,
      companies: companies.size,
      districts: districts.size,
      verified: rows.filter((r) => r.verificationStatus === 'verified').length,
    };
  }
  return byType;
}

/**
 * EPC sales series for the dashboard, from the sales recorded by event
 * (figureType event_product_count, product epc). Rejected rows excluded;
 * blanks are not counted.
 */
function epcSalesSeries(figures = []) {
  const rows = figures.filter((f) => f.figureType === 'event_product_count' && f.product === 'epc'
    && f.verificationStatus !== 'rejected' && f.quantity !== null && f.quantity !== undefined);
  const add = (map, key, qty) => map.set(key, (map.get(key) || 0) + qty);
  const months = new Map();
  const regions = new Map();
  const districts = new Map();
  let first = null;
  let last = null;
  for (const r of rows) {
    if (r.eventDate) {
      add(months, r.eventDate.slice(0, 7), r.quantity);
      if (!first || r.eventDate < first) first = r.eventDate;
      if (!last || r.eventDate > last) last = r.eventDate;
    }
    add(regions, r.region || 'Not stated', r.quantity);
    add(districts, r.district || 'Not stated', r.quantity);
  }
  const sorted = (map, keyName) => [...map.entries()].map(([k, quantity]) => ({ [keyName]: k, quantity })).sort((a, b) => b.quantity - a.quantity);
  return {
    total: rows.reduce((n, r) => n + r.quantity, 0),
    events: rows.length,
    firstDate: first,
    lastDate: last,
    byMonth: [...months.entries()].sort().map(([month, quantity]) => ({ month, quantity })),
    byRegion: sorted(regions, 'region'),
    byDistrict: sorted(districts, 'district'),
  };
}

module.exports = {
  epcSalesSeries,
  ATTRIBUTION_RULES,
  attributionFor,
  FIGURE_NOTES,
  MARKET_OPTIONS,
  marketLabel,
  marketValues,
  normalizeDistrict,
  normalizeRegion,
  quantityOrNull,
  summarizeMarketFigures,
};
