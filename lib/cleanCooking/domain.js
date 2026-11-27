/**
 * Clean Cooking domain rules (pure functions, no I/O) — unit-tested in
 * tests/cleanCookingDomain.test.cjs.
 */

const MAX_TEXT = 190;

function cleanText(value, max = MAX_TEXT) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Case/space-insensitive key used to match names ("Wana Energy Solutions " == "wana energy solutions"). */
function nameKey(value) {
  return cleanText(value).toLowerCase();
}

/**
 * Normalise a Ugandan phone number to E.164 (+2567XXXXXXXX).
 * Accepts 0700 123 456, 700123456, 256700123456, +256-700-123-456.
 * Returns '' for empty input and null when the number is not valid.
 */
function normalizeUgPhone(raw) {
  const text = cleanText(raw, 40);
  if (!text) return '';
  let digits = text.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('256')) digits = digits.slice(3);
  else if (digits.startsWith('0')) digits = digits.slice(1);
  if (!/^[37]\d{8}$/.test(digits)) return null;
  return `+256${digits}`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function normalizeEmail(raw) {
  const text = cleanText(raw).toLowerCase();
  if (!text) return '';
  return EMAIL_RE.test(text) ? text : null;
}

/** "6L", "6 l", "6", "6.5 litres" -> 6 / 6.5 ; returns null when not a size. */
function parseSizeLitres(raw) {
  const text = cleanText(raw, 40).toLowerCase();
  if (!text) return null;
  const match = text.match(/^(\d+(?:\.\d+)?)\s*(l|lt|ltr|litre|litres|liter|liters)?$/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 && value <= 1000 ? value : null;
}

/** Parse a non-negative whole quantity ("1,408" -> 1408). */
function parseQuantity(raw) {
  // Spreadsheet exports often write whole numbers as "150.0"; accept those,
  // but never round a real fraction ("150.5" stays invalid).
  const text = cleanText(raw, 20).replace(/,/g, '').replace(/\.0+$/, '');
  if (!/^\d+$/.test(text)) return null;
  const value = Number(text);
  return Number.isSafeInteger(value) ? value : null;
}

/**
 * Match a brand against the brands already in use so spelling variants do
 * not split the totals ("Pixels" -> "Pixel", "SimbaLand" -> "Simbaland").
 * Exact case-insensitive match first, then a trailing "s" plural match.
 */
function canonicalBrand(raw, knownBrands = []) {
  const brand = cleanText(raw, 100);
  if (!brand) return '';
  const key = brand.toLowerCase();
  const known = knownBrands.map((b) => cleanText(b, 100)).filter(Boolean);
  const exact = known.find((b) => b.toLowerCase() === key);
  if (exact) return exact;
  const singular = key.endsWith('s') ? key.slice(0, -1) : null;
  const plural = `${key}s`;
  const variant = known.find((b) => {
    const k = b.toLowerCase();
    return (singular && k === singular) || k === plural;
  });
  return variant || brand;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function monthIndex(token) {
  const key = cleanText(token, 20).toLowerCase().slice(0, 3);
  return MONTHS.indexOf(key);
}

/**
 * Turn a reporting-period label such as "Jan-March", "April-Nov" or
 * "Sep–Nov" plus a year into ISO start/end dates (UTC, whole months).
 * Returns null when the label cannot be understood.
 */
function periodFromLabel(label, year) {
  const text = cleanText(label, 64);
  const yr = Number(year);
  if (!text || !Number.isInteger(yr) || yr < 2000 || yr > 2100) return null;
  const parts = text.split(/\s*(?:-|–|—|to)\s*/i).filter(Boolean);
  if (parts.length < 1 || parts.length > 2) return null;
  const startMonth = monthIndex(parts[0]);
  const endMonth = monthIndex(parts[parts.length - 1]);
  if (startMonth < 0 || endMonth < 0 || endMonth < startMonth) return null;
  const start = new Date(Date.UTC(yr, startMonth, 1));
  const end = new Date(Date.UTC(yr, endMonth + 1, 0, 23, 59, 59));
  const fmt = (m) => MONTHS[m][0].toUpperCase() + MONTHS[m].slice(1);
  return {
    periodLabel: startMonth === endMonth ? `${fmt(startMonth)} ${yr}` : `${fmt(startMonth)}–${fmt(endMonth)} ${yr}`,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
  };
}

/**
 * Parse rows of the "EPCs SOLD BY DIFFERENT COMPANIES" sheet
 * (No., Company, Reporting Period, Brand, Product, Size, Quantity).
 * The company cell is only filled on a company's first row, so it is
 * carried forward. Blank separator rows are skipped. Returns
 * { rows, errors } where errors carry the 1-based source line.
 */
function parseCompanySalesSheet(table, { year } = {}) {
  const rows = [];
  const errors = [];
  if (!Array.isArray(table)) return { rows, errors: [{ line: 0, message: 'No rows found.' }] };

  const headerIndex = table.findIndex((cells) => Array.isArray(cells)
    && cells.some((c) => nameKey(c) === 'company')
    && cells.some((c) => nameKey(c) === 'quantity'));
  if (headerIndex < 0) {
    return { rows, errors: [{ line: 0, message: 'Could not find the header row (needs "Company" and "Quantity" columns).' }] };
  }
  const header = table[headerIndex].map(nameKey);
  const col = (name) => header.findIndex((h) => h === name || h.startsWith(name));
  const idx = {
    company: col('company'),
    period: col('reporting period'),
    brand: col('brand'),
    product: col('product'),
    size: col('size'),
    quantity: col('quantity'),
  };

  let currentCompany = '';
  for (let i = headerIndex + 1; i < table.length; i += 1) {
    const cells = table[i] || [];
    const line = i + 1;
    const get = (key) => (idx[key] >= 0 ? cleanText(cells[idx[key]]) : '');
    const companyCell = get('company');
    if (companyCell) currentCompany = companyCell;
    const brand = get('brand');
    const qtyRaw = get('quantity');
    const periodRaw = get('period');
    if (!brand && !qtyRaw && !periodRaw) continue; // separator row

    const problems = [];
    if (!currentCompany) problems.push('no company');
    const quantity = parseQuantity(qtyRaw);
    if (quantity === null) problems.push(`quantity "${qtyRaw}" is not a whole number`);
    if (!brand) problems.push('brand is empty');
    const period = periodFromLabel(periodRaw, year);
    if (!period) problems.push(`period "${periodRaw}" not understood`);
    const sizeRaw = get('size');
    const sizeLitres = sizeRaw ? parseSizeLitres(sizeRaw) : null;
    if (sizeRaw && sizeLitres === null) problems.push(`size "${sizeRaw}" not understood`);

    if (problems.length) {
      errors.push({ line, message: problems.join('; ') });
      continue;
    }
    rows.push({
      line,
      companyName: currentCompany,
      brand,
      product: get('product') || 'EPC',
      sizeLitres,
      quantity,
      ...period,
    });
  }
  return { rows, errors };
}

function addTo(map, key, qty) {
  map.set(key, (map.get(key) || 0) + qty);
}

function sortedEntries(map, keyName) {
  return [...map.entries()]
    .map(([key, quantity]) => ({ [keyName]: key, quantity }))
    .sort((a, b) => b.quantity - a.quantity);
}

/**
 * Aggregate company sales for the dashboard.
 * @param {Array} sales cc_company_sales documents
 * @param {Array} companies cc_companies documents
 */
function summarizeCompanySales(sales = [], companies = []) {
  const companyName = new Map(companies.map((c) => [c.$id, c.name]));
  const byCompany = new Map();
  const byBrand = new Map();
  const bySize = new Map();
  const byPeriod = new Map();
  let total = 0;
  for (const sale of sales) {
    const qty = Number(sale.quantity) || 0;
    total += qty;
    addTo(byCompany, companyName.get(sale.companyId) || 'Unknown company', qty);
    addTo(byBrand, sale.brand || 'Unknown', qty);
    addTo(bySize, sale.sizeLitres ? `${sale.sizeLitres}L` : 'Not stated', qty);
    addTo(byPeriod, sale.periodLabel || 'Unknown', qty);
  }
  const periodOrder = new Map();
  for (const sale of sales) {
    const label = sale.periodLabel || 'Unknown';
    const start = sale.periodStart || '';
    if (!periodOrder.has(label) || start < periodOrder.get(label)) periodOrder.set(label, start);
  }
  return {
    totalQuantity: total,
    recordCount: sales.length,
    companiesReporting: new Set(sales.map((s) => s.companyId)).size,
    brandCount: byBrand.size,
    byCompany: sortedEntries(byCompany, 'company'),
    byBrand: sortedEntries(byBrand, 'brand'),
    bySize: sortedEntries(bySize, 'size').sort((a, b) => (parseFloat(a.size) || 9999) - (parseFloat(b.size) || 9999)),
    byPeriod: [...byPeriod.entries()]
      .map(([period, quantity]) => ({ period, quantity, start: periodOrder.get(period) || '' }))
      .sort((a, b) => a.start.localeCompare(b.start))
      .map(({ period, quantity }) => ({ period, quantity })),
  };
}

module.exports = {
  canonicalBrand,
  cleanText,
  nameKey,
  normalizeEmail,
  normalizeUgPhone,
  parseCompanySalesSheet,
  parseQuantity,
  parseSizeLitres,
  periodFromLabel,
  summarizeCompanySales,
};
