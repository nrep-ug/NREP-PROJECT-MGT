/**
 * Champion EPC sales.
 * GET:  my sales
 * POST: record a sale (idempotent). If it comes from one of my open leads,
 *       the lead is marked "converted to sale" and linked — one sale per lead.
 */
import { adminDatabases, DB_ID, Query } from '@/lib/appwriteAdmin';
import { appendStageHistory, validateFieldSale } from '@/lib/cleanCooking/fieldDomain';
import { OPEN_LEAD_STAGES } from '@/lib/cleanCooking/fieldOptions';
import { canonicalBrand } from '@/lib/cleanCooking/domain';
import { CC, createOnce, fieldHandler, getOwn, HttpError, listAll, readJson, submissionStamp } from '@/lib/cleanCooking/fieldService';

export const GET = fieldHandler(async ({ champion }) => {
  const sales = await listAll(CC.FIELD_SALES, [Query.equal('championId', champion.$id), Query.orderDesc('saleDate')]);
  return { sales };
});

export const POST = fieldHandler(async ({ request, champion, account }) => {
  const fields = validateFieldSale(await readJson(request));

  // Idempotency first: a re-sent submission must not trip the lead checks below.
  const already = await adminDatabases.listDocuments(DB_ID, CC.FIELD_SALES, [
    Query.equal('clientSubmissionId', fields.clientSubmissionId),
    Query.limit(1),
  ]);
  if (already.documents[0]) {
    if (already.documents[0].championId !== champion.$id) throw new HttpError(409, 'Duplicate submission ID.', 'DUPLICATE');
    return { sale: already.documents[0], duplicate: true };
  }

  let lead = null;
  if (fields.leadId) {
    lead = await getOwn(CC.LEADS, fields.leadId, champion, 'Lead');
    if (!OPEN_LEAD_STAGES.includes(lead.stage) || lead.saleId) {
      throw new HttpError(409, 'That lead is already closed or has a sale recorded.', 'LEAD_CLOSED');
    }
  }

  if (fields.supplierCompanyId) {
    try {
      const company = await adminDatabases.getDocument(DB_ID, CC.COMPANIES, fields.supplierCompanyId);
      if (company.projectId !== champion.projectId) fields.supplierCompanyId = null;
    } catch {
      fields.supplierCompanyId = null;
    }
  }

  // Merge brand spelling variants with brands already reported.
  const known = await listAll(CC.COMPANY_SALES, [Query.equal('projectId', champion.projectId), Query.select(['$id', 'brand'])]);
  fields.brand = canonicalBrand(fields.brand, [...new Set(known.map((s) => s.brand))]);

  const { record, duplicate } = await createOnce(CC.FIELD_SALES, {
    ...submissionStamp(champion, account),
    ...fields,
    verificationStatus: 'submitted',
  }, champion);

  if (lead && !duplicate) {
    await adminDatabases.updateDocument(DB_ID, CC.LEADS, lead.$id, {
      stage: 'converted_to_sale',
      saleId: record.$id,
      stageHistory: appendStageHistory(lead.stageHistory, {
        from: lead.stage, to: 'converted_to_sale', at: new Date().toISOString(), by: account.$id,
      }),
    });
  }
  return { sale: record, duplicate };
}, { status: 201 });
