#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Load Clean Cooking champions from a JSON file into a project.
 *
 *   node scripts/seed-clean-cooking-champions.js <file.json> [--project=BCCeC] [--apply]
 *
 * Default is a read-only plan. With --apply it creates missing districts and
 * champions. Champions already present (same name in the same district) are
 * skipped, so the script is safe to re-run.
 *
 * The JSON file holds personal data — keep it OUT of the repository.
 * Format: [{ "district": "Kabale", "fullName": "Jane Example",
 *            "phone": "0700123456", "email": "...", "isDistrictLead": true }]
 */

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { Client, Databases, ID, Query } = require('node-appwrite');
const { CLEAN_COOKING_COLLECTION_IDS: CC } = require('../lib/cleanCooking/schema.cjs');
const { cleanText, nameKey, normalizeEmail, normalizeUgPhone } = require('../lib/cleanCooking/domain');

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const file = args.find((a) => !a.startsWith('--'));
const projectCode = (args.find((a) => a.startsWith('--project=')) || '--project=BCCeC').split('=')[1];
const ENV = process.env;
const DB = ENV.APPWRITE_DATABASE_ID || ENV.NEXT_PUBLIC_APPWRITE_DATABASE_ID || '68fb5845001d32f31656';

if (!file) {
  console.error('Usage: node scripts/seed-clean-cooking-champions.js <file.json> [--project=BCCeC] [--apply]');
  process.exit(1);
}

const db = new Databases(new Client()
  .setEndpoint(ENV.APPWRITE_ENDPOINT)
  .setProject(ENV.APPWRITE_PROJECT_ID)
  .setKey(ENV.APPWRITE_API_KEY));

const titleCase = (s) => cleanText(s).toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase());

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

async function run() {
  const input = JSON.parse(fs.readFileSync(file, 'utf8'));
  const projects = await db.listDocuments(DB, 'pms_projects', [Query.equal('code', projectCode), Query.limit(1)]);
  const project = projects.documents[0];
  if (!project) throw new Error(`Project with code ${projectCode} not found.`);
  const projectId = project.$id;

  const [districts, champions] = await Promise.all([
    listAll(CC.DISTRICTS, [Query.equal('projectId', projectId)]),
    listAll(CC.CHAMPIONS, [Query.equal('projectId', projectId)]),
  ]);
  const districtNames = new Map(districts.map((d) => [nameKey(d.name), d.name]));
  const existing = new Set(champions.map((c) => `${nameKey(c.district)}|${nameKey(c.fullName)}`));
  const phones = new Set(champions.map((c) => c.phone).filter(Boolean));

  const newDistricts = [];
  const toCreate = [];
  const problems = [];
  for (const [i, row] of input.entries()) {
    const district = titleCase(row.district);
    const fullName = titleCase(row.fullName);
    if (!district || !fullName) { problems.push(`row ${i + 1}: missing name or district`); continue; }
    const phone = normalizeUgPhone(row.phone);
    const email = normalizeEmail(row.email);
    if (phone === null) { problems.push(`${fullName}: invalid phone "${row.phone}"`); continue; }
    if (email === null) { problems.push(`${fullName}: invalid email "${row.email}"`); continue; }
    if (!districtNames.has(nameKey(district))) { districtNames.set(nameKey(district), district); newDistricts.push(district); }
    const key = `${nameKey(district)}|${nameKey(fullName)}`;
    if (existing.has(key)) continue;
    if (phone && phones.has(phone)) { problems.push(`${fullName}: phone ${phone} already used by another champion`); continue; }
    existing.add(key);
    if (phone) phones.add(phone);
    toCreate.push({ projectId, fullName, district: districtNames.get(nameKey(district)), phone: phone || null, email: email || null, isDistrictLead: Boolean(row.isDistrictLead), gender: 'unspecified', status: 'active' });
  }

  console.log(`Project ${projectCode} (${projectId}) — ${APPLY ? 'APPLY' : 'read-only plan'}`);
  console.log(`Districts to add: ${newDistricts.length ? newDistricts.join(', ') : 'none'}`);
  console.log(`Champions to add: ${toCreate.length} (already present: ${input.length - toCreate.length - problems.length})`);
  const byDistrict = {};
  for (const c of toCreate) (byDistrict[c.district] ||= []).push(`${c.fullName}${c.isDistrictLead ? ' [lead]' : ''}${c.phone ? ' ☎' : ''}${c.email ? ' ✉' : ''}`);
  for (const [d, names] of Object.entries(byDistrict)) console.log(`  ${d}: ${names.join(', ')}`);
  if (problems.length) { console.log('Skipped with problems:'); problems.forEach((p) => console.log(`  - ${p}`)); }
  if (!APPLY) { console.log('No changes made. Re-run with --apply to create them.'); return; }

  for (const name of newDistricts) {
    await db.createDocument(DB, CC.DISTRICTS, ID.unique(), { projectId, name });
  }
  for (const c of toCreate) {
    await db.createDocument(DB, CC.CHAMPIONS, ID.unique(), c);
  }
  console.log(`Done: ${newDistricts.length} districts and ${toCreate.length} champions created.`);
}

run().catch((error) => { console.error(`Stopped: ${error.message}`); process.exit(1); });
