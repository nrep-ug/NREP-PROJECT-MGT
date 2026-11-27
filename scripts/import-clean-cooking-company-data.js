#!/usr/bin/env node
/**
 * Import Phase 1 company data into a project's Clean Cooking module.
 *
 *   node scripts/import-clean-cooking-company-data.js \
 *     --sales=<epc_sales_table.json> --year=2025 \
 *     [--companies=<company_names.json>] [--project=BCCeC] [--apply]
 *
 * --sales      JSON array of rows (array of cells) from the tracker's
 *              "EPC SALES" sheet. Parsed with the SAME parser and the SAME
 *              duplicate rule as the in-app import (Clean Cooking → Company
 *              sales → Import), so re-running never double-counts.
 * --year       Calendar year the sheet's periods ("Jan-March", "April-Nov")
 *              belong to. Required: never guessed.
 * --companies  Optional JSON array of company names (e.g. the UNACC member
 *              list). Each name is matched loosely against existing companies
 *              and the sales sheet ("UP Energy" ~ "UpEnergy"); only unmatched
 *              names are created. Every match is printed for review.
 *
 * Dry run by default: prints what would happen and writes nothing.
 * Source files stay OUTSIDE the repository.
 */
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { Client, Databases, ID, Query } = require('node-appwrite');
const { CLEAN_COOKING_COLLECTION_IDS: CC } = require('../lib/cleanCooking/schema.cjs');
const { canonicalBrand, cleanText, nameKey, parseCompanySalesSheet } = require('../lib/cleanCooking/domain');

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, ...v] = a.replace(/^--/, '').split('=');
  return [k, v.length ? v.join('=') : true];
}));
const APPLY = args.apply === true;
const projectCode = args.project || 'BCCeC';
const year = Number(args.year);
if (!args.sales || !Number.isInteger(year) || year < 2020 || year > 2100) {
  console.error('Usage: node scripts/import-clean-cooking-company-data.js --sales=<file.json> --year=<YYYY> [--companies=<file.json>] [--project=BCCeC] [--apply]');
  process.exit(1);
}

const ENV = process.env;
const DB = ENV.APPWRITE_DATABASE_ID || ENV.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
const PROJECTS = ENV.NEXT_PUBLIC_APPWRITE_COL_PROJECTS || 'pms_projects';
const db = new Databases(new Client().setEndpoint(ENV.APPWRITE_ENDPOINT).setProject(ENV.APPWRITE_PROJECT_ID).setKey(ENV.APPWRITE_API_KEY));

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

// Same key as app/api/clean-cooking/[projectId]/sales/import/route.js
const rowKey = (companyKey, row) => [companyKey, row.periodLabel, nameKey(row.brand), row.sizeLitres ?? '', row.quantity].join('|');

// Company matching is EXACT after normalising: lower case, letters/digits only,
// legal/sector words removed, trailing plural "s" dropped. No prefix matching:
// "Ugas" (LPG) must never match "Ugastove". Two keys per name, with and
// without the word "energy" ("Eco Tech" = "Eco Tech Energy Holding").
const NOISE = /\b(ltd|limited|co|company|uganda|u|solutions?|holdings?|enterprises?|technologies|technology|carbon|conscious|general|merchandise|merchidise)\b/g;
const keysOf = (name) => {
  const base = cleanText(name).toLowerCase().replace(/-/g, '').replace(NOISE, ' ');
  return [base, base.replace(/\benergy\b/g, ' ')]
    .map((k) => k.replace(/[^a-z0-9]/g, '').replace(/s$/, ''))
    .filter(Boolean);
};
function looseMatch(name, candidates) {
  const mine = keysOf(name);
  return candidates.find((c) => keysOf(c).some((k) => mine.includes(k))) || null;
}

(async () => {
  const projects = await db.listDocuments(DB, PROJECTS, [Query.equal('code', projectCode), Query.limit(2)]);
  if (projects.total !== 1) throw new Error(`Expected one project with code "${projectCode}", found ${projects.total}.`);
  const project = projects.documents[0];
  console.log(`Project: ${project.name} (${project.code}, ${project.$id})`);
  console.log(`Mode: ${APPLY ? 'APPLY — writing to the database' : 'DRY RUN — nothing will be written'}\n`);

  const [companies, existingSales] = await Promise.all([
    listAll(CC.COMPANIES, [Query.equal('projectId', project.$id)]),
    listAll(CC.COMPANY_SALES, [Query.equal('projectId', project.$id)]),
  ]);
  console.log(`Currently in the system: ${companies.length} companies, ${existingSales.length} company-sales records (${existingSales.reduce((n, s) => n + s.quantity, 0)} EPCs).\n`);

  // ---------------- Company sales (same logic as the in-app import) ----------------
  const table = JSON.parse(fs.readFileSync(args.sales, 'utf8'));
  const { rows, errors } = parseCompanySalesSheet(table, { year });
  const companyByKey = new Map(companies.map((c) => [nameKey(c.name), c]));
  const knownBrands = [...new Set(existingSales.map((s) => s.brand))];
  const existingKeys = new Set(existingSales.map((s) => {
    const company = companies.find((c) => c.$id === s.companyId);
    return rowKey(nameKey(company?.name || s.companyId), s);
  }));
  const newSalesCompanies = [...new Set(rows.map((r) => r.companyName))].filter((n) => !companyByKey.has(nameKey(n)));
  const prepared = [];
  const seen = new Set();
  let skipped = 0;
  for (const row of rows) {
    const brand = canonicalBrand(row.brand, knownBrands);
    if (!knownBrands.some((b) => nameKey(b) === nameKey(brand))) knownBrands.push(brand);
    const normalized = { ...row, brand };
    const key = rowKey(nameKey(row.companyName), normalized);
    if (existingKeys.has(key) || seen.has(key)) { skipped += 1; continue; }
    seen.add(key);
    prepared.push(normalized);
  }
  const byPeriod = {};
  for (const r of prepared) byPeriod[`${r.periodLabel} (${r.periodStart.slice(0, 10)} → ${r.periodEnd.slice(0, 10)})`] = (byPeriod[`${r.periodLabel} (${r.periodStart.slice(0, 10)} → ${r.periodEnd.slice(0, 10)})`] || 0) + r.quantity;
  console.log('— Company EPC sales —');
  console.log(`Parsed ${rows.length} sales rows; ${prepared.length} new, ${skipped} already in the system.`);
  console.log(`New EPCs to add: ${prepared.reduce((n, r) => n + r.quantity, 0)}`);
  for (const [p, q] of Object.entries(byPeriod)) console.log(`  ${p}: ${q}`);
  console.log(`Rows not imported (${errors.length}) — subtotal lines are expected here:`);
  for (const e of errors) console.log(`  line ${e.line}: ${e.message}`);
  console.log(`New companies from the sales sheet (${newSalesCompanies.length}): ${newSalesCompanies.join(', ') || '—'}\n`);

  // ---------------- Extra company names (e.g. UNACC members) ----------------
  let extraToCreate = [];
  if (args.companies) {
    const names = JSON.parse(fs.readFileSync(args.companies, 'utf8')).map((n) => cleanText(n, 190)).filter(Boolean);
    const pool = [...companies.map((c) => c.name), ...newSalesCompanies];
    console.log('— Company list —');
    for (const name of names) {
      const match = looseMatch(name, pool);
      if (match) console.log(`  = "${name}" matches existing/sales company "${match}" (not created)`);
      else { extraToCreate.push(name); pool.push(name); }
    }
    console.log(`  + to create (${extraToCreate.length}): ${extraToCreate.join(', ') || '—'}\n`);
  }

  if (!APPLY) {
    console.log('Dry run complete. Re-run with --apply to write.');
    return;
  }

  // ---------------- Apply ----------------
  for (const name of [...newSalesCompanies, ...extraToCreate]) {
    const doc = await db.createDocument(DB, CC.COMPANIES, ID.unique(), { projectId: project.$id, name, status: 'active', createdBy: 'import-script' });
    companyByKey.set(nameKey(name), doc);
  }
  let created = 0;
  for (const row of prepared) {
    const company = companyByKey.get(nameKey(row.companyName));
    await db.createDocument(DB, CC.COMPANY_SALES, ID.unique(), {
      projectId: project.$id,
      companyId: company.$id,
      periodLabel: row.periodLabel,
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      brand: row.brand,
      product: row.product,
      sizeLitres: row.sizeLitres,
      quantity: row.quantity,
      source: 'import',
      notes: `Master tracker "EPC SALES" sheet, line ${row.line}`,
      createdBy: 'import-script',
    });
    created += 1;
  }
  console.log(`Done: ${newSalesCompanies.length + extraToCreate.length} companies and ${created} sales records created.`);
})().catch((error) => {
  console.error('Import stopped:', error.message);
  process.exit(1);
});
