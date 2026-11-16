/**
 * POST /api/clean-cooking/[projectId]/sales/import
 * Body: { table: string[][] (the sheet as rows of cells), year: number, apply?: boolean }
 *
 * Parses the "EPCs SOLD BY DIFFERENT COMPANIES" sheet. Without apply=true it
 * only returns a preview. With apply=true it creates missing companies and
 * the sales records. Rows that already exist (same company, period, brand,
 * size and quantity) are skipped so importing the same sheet twice does not
 * double-count.
 */
import { adminDatabases, DB_ID, ID, Query } from '@/lib/appwriteAdmin';
import { CC, ccHandler, HttpError, listAll, readBody } from '@/lib/cleanCooking/service';
import { canonicalBrand, nameKey, parseCompanySalesSheet } from '@/lib/cleanCooking/domain';

const MAX_ROWS = 2000;

function rowKey(companyKey, row) {
  return [companyKey, row.periodLabel, nameKey(row.brand), row.sizeLitres ?? '', row.quantity].join('|');
}

export const POST = ccHandler('write', async ({ request, context, params }) => {
  const body = await readBody(request);
  if (!Array.isArray(body.table) || body.table.length > MAX_ROWS + 20) {
    throw new HttpError(400, `Send the sheet as rows (max ${MAX_ROWS}).`, 'VALIDATION_ERROR');
  }
  const year = Number(body.year);
  const { rows, errors } = parseCompanySalesSheet(body.table, { year });
  if (!rows.length && errors.length) return { applied: false, rows: [], errors, created: 0, skipped: 0, newCompanies: [] };

  const [companies, existingSales] = await Promise.all([
    listAll(CC.COMPANIES, [Query.equal('projectId', params.projectId)]),
    listAll(CC.COMPANY_SALES, [Query.equal('projectId', params.projectId)]),
  ]);
  const companyByKey = new Map(companies.map((c) => [nameKey(c.name), c]));
  const knownBrands = [...new Set(existingSales.map((s) => s.brand))];
  const existingKeys = new Set(existingSales.map((s) => {
    const company = companies.find((c) => c.$id === s.companyId);
    return rowKey(nameKey(company?.name || s.companyId), s);
  }));

  const newCompanies = [...new Set(rows.map((r) => r.companyName))]
    .filter((name) => !companyByKey.has(nameKey(name)));

  const prepared = [];
  let skipped = 0;
  const seen = new Set();
  for (const row of rows) {
    const brand = canonicalBrand(row.brand, knownBrands);
    if (!knownBrands.some((b) => nameKey(b) === nameKey(brand))) knownBrands.push(brand);
    const normalized = { ...row, brand };
    const key = rowKey(nameKey(row.companyName), normalized);
    if (existingKeys.has(key) || seen.has(key)) {
      skipped += 1;
      continue;
    }
    seen.add(key);
    prepared.push(normalized);
  }

  const preview = {
    rows: prepared,
    errors,
    skipped,
    newCompanies,
    totalQuantity: prepared.reduce((sum, r) => sum + r.quantity, 0),
  };
  if (body.apply !== true) return { applied: false, ...preview };

  for (const name of newCompanies) {
    const company = await adminDatabases.createDocument(DB_ID, CC.COMPANIES, ID.unique(), {
      projectId: params.projectId,
      name,
      status: 'active',
      createdBy: context.accountId,
    });
    companyByKey.set(nameKey(name), company);
  }

  let created = 0;
  for (const row of prepared) {
    const company = companyByKey.get(nameKey(row.companyName));
    await adminDatabases.createDocument(DB_ID, CC.COMPANY_SALES, ID.unique(), {
      projectId: params.projectId,
      companyId: company.$id,
      periodLabel: row.periodLabel,
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      brand: row.brand,
      product: row.product,
      sizeLitres: row.sizeLitres,
      quantity: row.quantity,
      source: 'import',
      createdBy: context.accountId,
    });
    created += 1;
  }
  return { applied: true, created, ...preview };
});
