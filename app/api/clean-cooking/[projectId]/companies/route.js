/**
 * Companies (EPC distributors) reporting sales to the project.
 * GET:  list companies with their total reported quantity
 * POST: add a company
 */
import { adminDatabases, DB_ID, ID, Query } from '@/lib/appwriteAdmin';
import { CC, ccHandler, HttpError, listAll, readBody } from '@/lib/cleanCooking/service';
import { nameKey } from '@/lib/cleanCooking/domain';
import { companyFields } from '@/lib/cleanCooking/validation';

export const GET = ccHandler('read', async ({ params }) => {
  const [companies, sales] = await Promise.all([
    listAll(CC.COMPANIES, [Query.equal('projectId', params.projectId)]),
    listAll(CC.COMPANY_SALES, [Query.equal('projectId', params.projectId), Query.select(['$id', 'companyId', 'quantity'])]),
  ]);
  const totals = new Map();
  for (const sale of sales) totals.set(sale.companyId, (totals.get(sale.companyId) || 0) + (Number(sale.quantity) || 0));
  return {
    companies: companies
      .map((c) => ({ ...c, totalQuantity: totals.get(c.$id) || 0 }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
});

export const POST = ccHandler('write', async ({ request, context, params }) => {
  const fields = companyFields(await readBody(request));
  if (!fields.name) throw new HttpError(400, 'Company name is required.', 'VALIDATION_ERROR');
  const existing = await listAll(CC.COMPANIES, [Query.equal('projectId', params.projectId), Query.select(['$id', 'name'])]);
  if (existing.some((c) => nameKey(c.name) === nameKey(fields.name))) {
    throw new HttpError(409, `A company called "${fields.name}" already exists.`, 'DUPLICATE');
  }
  const company = await adminDatabases.createDocument(DB_ID, CC.COMPANIES, ID.unique(), {
    projectId: params.projectId,
    status: 'active',
    ...fields,
    createdBy: context.accountId,
  });
  return { company };
}, { status: 201 });
