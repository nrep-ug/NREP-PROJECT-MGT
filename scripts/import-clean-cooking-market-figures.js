#!/usr/bin/env node
/**
 * Import market & sales figures (company-wide totals, products counted at
 * events) into cc_market_figures. EPCs distributed by NREP are not imported:
 * they are already part of the company sales.
 *
 *   node scripts/import-clean-cooking-market-figures.js --rows=<market_rows.json> [--project=BCCeC] [--apply]
 *
 * --rows  JSON array of normalised records (figureType, product, quantity,
 *         dates, district…, sourceSheet, sourceRow, sourceRowHash). Built
 *         outside the repo from the tracker / Kobo; holds no personal data.
 *
 * Every row is validated against lib/cleanCooking/marketDomain.js. Rows whose
 * sourceRowHash already exists are skipped, so re-running never duplicates.
 * Company totals are linked to an existing company when the name matches.
 * Records are stored as "unverified". Dry run by default.
 */
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { Client, Databases, ID, Query } = require('node-appwrite');
const { CLEAN_COOKING_COLLECTION_IDS: CC } = require('../lib/cleanCooking/schema.cjs');
const { cleanText } = require('../lib/cleanCooking/domain');
const { marketValues } = require('../lib/cleanCooking/marketDomain');

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, ...v] = a.replace(/^--/, '').split('=');
  return [k, v.length ? v.join('=') : true];
}));
const APPLY = args.apply === true;
if (!args.rows) {
  console.error('Usage: node scripts/import-clean-cooking-market-figures.js --rows=<file.json> [--project=BCCeC] [--apply]');
  process.exit(1);
}
const E = process.env;
const DB = E.APPWRITE_DATABASE_ID || E.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
const db = new Databases(new Client().setEndpoint(E.APPWRITE_ENDPOINT).setProject(E.APPWRITE_PROJECT_ID).setKey(E.APPWRITE_API_KEY));

async function listAll(collectionId, queries) {
  const out = [];
  let cursor = null;
  for (;;) {
    const page = await db.listDocuments(DB, collectionId, [...queries, Query.limit(100), ...(cursor ? [Query.cursorAfter(cursor)] : [])]);
    out.push(...page.documents);
    if (page.documents.length < 100) return out;
    cursor = page.documents[page.documents.length - 1].$id;
  }
}

// Exact company match after normalising (same rule as import-clean-cooking-company-data.js).
const NOISE = /\b(ltd|limited|co|company|uganda|u|solutions?|holdings?|enterprises?|technologies|technology|carbon|conscious|general|merchandise|merchidise)\b/g;
const keysOf = (name) => {
  const base = cleanText(name).toLowerCase().replace(/-/g, '').replace(NOISE, ' ');
  return [base, base.replace(/\benergy\b/g, ' ')].map((k) => k.replace(/[^a-z0-9]/g, '').replace(/s$/, '')).filter(Boolean);
};

const FIELDS = ['figureType', 'product', 'quantity', 'attributionRate', 'attributedQuantity', 'periodLabel', 'periodStart', 'periodEnd', 'eventDate', 'eventName', 'region', 'district', 'subLocation', 'districtRaw', 'companyName', 'notes', 'sourceSheet', 'sourceRow', 'sourceRowHash'];
function validate(row, i) {
  const problems = [];
  if (!marketValues('figureType').includes(row.figureType)) problems.push(`figureType "${row.figureType}"`);
  if (!marketValues('product').includes(row.product)) problems.push(`product "${row.product}"`);
  if (row.quantity !== null && (!Number.isInteger(row.quantity) || row.quantity < 0)) problems.push(`quantity "${row.quantity}"`);
  if (!/^[0-9a-f]{64}$/.test(row.sourceRowHash || '')) problems.push('sourceRowHash missing');
  if (row.attributionRate !== undefined && (typeof row.attributionRate !== 'number' || row.attributionRate < 0 || row.attributionRate > 1)) problems.push(`attributionRate "${row.attributionRate}"`);
  for (const k of ['eventDate', 'periodStart', 'periodEnd']) if (row[k] && Number.isNaN(Date.parse(row[k]))) problems.push(`${k} "${row[k]}"`);
  if (problems.length) throw new Error(`record ${i + 1}: invalid ${problems.join(', ')}`);
  const doc = {};
  for (const k of FIELDS) if (row[k] !== undefined && row[k] !== '') doc[k] = row[k];
  if (doc.notes) doc.notes = cleanText(doc.notes, 500);
  if (doc.eventName) doc.eventName = cleanText(doc.eventName, 300);
  return doc;
}

(async () => {
  const projects = await db.listDocuments(DB, E.NEXT_PUBLIC_APPWRITE_COL_PROJECTS || 'pms_projects', [Query.equal('code', args.project || 'BCCeC'), Query.limit(2)]);
  if (projects.total !== 1) throw new Error(`Expected one project with code "${args.project || 'BCCeC'}", found ${projects.total}.`);
  const project = projects.documents[0];
  console.log(`Project: ${project.name} (${project.code})`);
  console.log(`Mode: ${APPLY ? 'APPLY — writing to the database' : 'DRY RUN — nothing will be written'}\n`);

  const rows = JSON.parse(fs.readFileSync(args.rows, 'utf8')).map(validate);
  const companies = await listAll(CC.COMPANIES, [Query.equal('projectId', project.$id)]);
  let existing = [];
  let tableReady = true;
  try {
    existing = await listAll(CC.MARKET_FIGURES, [Query.equal('projectId', project.$id), Query.select(['$id', 'sourceRowHash'])]);
  } catch (error) {
    if (error?.code !== 404) throw error;
    tableReady = false;
    console.log('Note: the cc_market_figures table does not exist yet. Run: npm run schema:clean-cooking -- --apply\n');
  }
  const have = new Set(existing.map((d) => d.sourceRowHash));

  const todo = [];
  const linked = [];
  for (const row of rows) {
    if (have.has(row.sourceRowHash)) continue;
    if (row.companyName) {
      const mine = keysOf(row.companyName);
      const match = companies.find((c) => keysOf(c.name).some((k) => mine.includes(k)));
      if (match) { row.companyId = match.$id; linked.push(`${row.companyName} → ${match.name}`); }
    }
    todo.push(row);
  }

  const totals = {};
  for (const r of todo) {
    const key = `${r.figureType} / ${r.product}`;
    totals[key] = (totals[key] || 0) + (r.attributedQuantity ?? r.quantity ?? 0);
  }
  console.log(`Records in file: ${rows.length}; already imported: ${rows.length - todo.length}; to add: ${todo.length}`);
  console.log('Counted totals (attribution rules applied; reported figures are stored unchanged):');
  for (const [k, v] of Object.entries(totals).sort()) console.log(`  ${k}: ${v.toLocaleString('en-US')}`);
  console.log(`Company totals linked to existing companies (${linked.length}): ${linked.join('; ') || '—'}\n`);

  if (!APPLY) { console.log('Dry run complete. Re-run with --apply to write.'); return; }
  if (!tableReady) throw new Error('Create the cc_market_figures table first (npm run schema:clean-cooking -- --apply).');
  let created = 0;
  for (const row of todo) {
    await db.createDocument(DB, CC.MARKET_FIGURES, ID.unique(), {
      projectId: project.$id, ...row, verificationStatus: 'unverified', importedBy: 'import-script',
    });
    created += 1;
  }
  console.log(`Done: ${created} records created.`);
})().catch((error) => {
  console.error('Import stopped:', error.message);
  process.exit(1);
});
