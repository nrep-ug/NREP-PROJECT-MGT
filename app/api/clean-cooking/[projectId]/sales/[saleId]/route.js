/**
 * PATCH:  correct a sales record
 * DELETE: delete a sales record (project owner/manager or admin)
 */
import { adminDatabases, DB_ID } from '@/lib/appwriteAdmin';
import { CC, ccHandler, getProjectDocument, readBody } from '@/lib/cleanCooking/service';
import { saleFields } from '@/lib/cleanCooking/validation';

export const PATCH = ccHandler('write', async ({ request, params }) => {
  await getProjectDocument(CC.COMPANY_SALES, params.saleId, params.projectId, 'Sales record');
  const fields = saleFields(await readBody(request), { partial: true });
  if (fields.companyId) await getProjectDocument(CC.COMPANIES, fields.companyId, params.projectId, 'Company');
  const sale = await adminDatabases.updateDocument(DB_ID, CC.COMPANY_SALES, params.saleId, fields);
  return { sale };
});

export const DELETE = ccHandler('manage', async ({ params }) => {
  await getProjectDocument(CC.COMPANY_SALES, params.saleId, params.projectId, 'Sales record');
  await adminDatabases.deleteDocument(DB_ID, CC.COMPANY_SALES, params.saleId);
  return { success: true };
});
