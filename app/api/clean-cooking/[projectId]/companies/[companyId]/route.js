/**
 * PATCH:  update a company
 * DELETE: delete a company (only when it has no sales records)
 */
import { adminDatabases, DB_ID, Query } from '@/lib/appwriteAdmin';
import { CC, ccHandler, getProjectDocument, HttpError, listAll, readBody } from '@/lib/cleanCooking/service';
import { nameKey } from '@/lib/cleanCooking/domain';
import { companyFields } from '@/lib/cleanCooking/validation';

export const PATCH = ccHandler('write', async ({ request, params }) => {
  await getProjectDocument(CC.COMPANIES, params.companyId, params.projectId, 'Company');
  const fields = companyFields(await readBody(request));
  if (fields.name) {
    const others = await listAll(CC.COMPANIES, [Query.equal('projectId', params.projectId), Query.select(['$id', 'name'])]);
    if (others.some((c) => c.$id !== params.companyId && nameKey(c.name) === nameKey(fields.name))) {
      throw new HttpError(409, `A company called "${fields.name}" already exists.`, 'DUPLICATE');
    }
  }
  const company = await adminDatabases.updateDocument(DB_ID, CC.COMPANIES, params.companyId, fields);
  return { company };
});

export const DELETE = ccHandler('manage', async ({ params }) => {
  await getProjectDocument(CC.COMPANIES, params.companyId, params.projectId, 'Company');
  const sales = await adminDatabases.listDocuments(DB_ID, CC.COMPANY_SALES, [
    Query.equal('companyId', params.companyId),
    Query.limit(1),
  ]);
  if (sales.total > 0) {
    throw new HttpError(409, 'This company has sales records. Delete those first, or mark the company inactive.', 'HAS_SALES');
  }
  await adminDatabases.deleteDocument(DB_ID, CC.COMPANIES, params.companyId);
  return { success: true };
});
