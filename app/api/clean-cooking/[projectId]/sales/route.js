/**
 * Company EPC sales records.
 * GET:  list records (optional ?companyId=)
 * POST: add one record
 */
import { adminDatabases, DB_ID, ID, Query } from '@/lib/appwriteAdmin';
import { CC, ccHandler, getProjectDocument, listAll, readBody } from '@/lib/cleanCooking/service';
import { canonicalBrand } from '@/lib/cleanCooking/domain';
import { saleFields } from '@/lib/cleanCooking/validation';

export const GET = ccHandler('read', async ({ request, params }) => {
  const { searchParams } = new URL(request.url);
  const queries = [Query.equal('projectId', params.projectId), Query.orderDesc('periodStart')];
  const companyId = searchParams.get('companyId');
  if (companyId) queries.push(Query.equal('companyId', companyId));
  const sales = await listAll(CC.COMPANY_SALES, queries);
  return { sales };
});

export const POST = ccHandler('write', async ({ request, context, params }) => {
  const fields = saleFields(await readBody(request));
  await getProjectDocument(CC.COMPANIES, fields.companyId, params.projectId, 'Company');
  const known = await listAll(CC.COMPANY_SALES, [Query.equal('projectId', params.projectId), Query.select(['$id', 'brand'])]);
  fields.brand = canonicalBrand(fields.brand, [...new Set(known.map((s) => s.brand))]);
  const sale = await adminDatabases.createDocument(DB_ID, CC.COMPANY_SALES, ID.unique(), {
    projectId: params.projectId,
    ...fields,
    source: 'manual',
    createdBy: context.accountId,
  });
  return { sale };
}, { status: 201 });
