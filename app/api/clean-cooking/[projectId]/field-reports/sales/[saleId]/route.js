/**
 * PATCH /api/clean-cooking/[projectId]/field-reports/sales/[saleId]
 * Verify, flag or reject a champion-reported sale.
 * Only verified sales count as programme results.
 * Project owner/manager or organization admin.
 */
import { adminDatabases, DB_ID } from '@/lib/appwriteAdmin';
import { CC, ccHandler, getProjectDocument, HttpError, readBody } from '@/lib/cleanCooking/service';
import { cleanText } from '@/lib/cleanCooking/domain';

const ALLOWED = ['verified', 'needs_review', 'rejected', 'submitted'];

export const PATCH = ccHandler('manage', async ({ request, context, params }) => {
  await getProjectDocument(CC.FIELD_SALES, params.saleId, params.projectId, 'Sale');
  const body = await readBody(request);
  if (!ALLOWED.includes(body.verificationStatus)) {
    throw new HttpError(400, 'Choose verified, needs review or rejected.', 'VALIDATION_ERROR');
  }
  const note = cleanText(body.verificationNote, 500) || null;
  if ((body.verificationStatus === 'rejected' || body.verificationStatus === 'needs_review') && !note) {
    throw new HttpError(400, 'Add a short reason so the champion knows what to fix.', 'VALIDATION_ERROR');
  }
  const sale = await adminDatabases.updateDocument(DB_ID, CC.FIELD_SALES, params.saleId, {
    verificationStatus: body.verificationStatus,
    verificationNote: note,
    verifiedBy: context.accountId,
    verifiedAt: new Date().toISOString(),
  });
  return { sale };
});
