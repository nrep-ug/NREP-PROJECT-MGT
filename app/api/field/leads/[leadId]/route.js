/**
 * PATCH /api/field/leads/[leadId] — update progress on one of my leads
 * (stage, main barrier, next action, follow-up date, notes).
 */
import { adminDatabases, DB_ID } from '@/lib/appwriteAdmin';
import { appendStageHistory, validateLeadUpdate } from '@/lib/cleanCooking/fieldDomain';
import { CC, fieldHandler, getOwn, HttpError, readJson } from '@/lib/cleanCooking/fieldService';

export const PATCH = fieldHandler(async ({ request, params, champion, account }) => {
  const lead = await getOwn(CC.LEADS, params.leadId, champion, 'Lead');
  if (lead.stage === 'converted_to_sale') {
    throw new HttpError(409, 'This lead is already a sale and can no longer be changed.', 'LEAD_CLOSED');
  }
  const fields = validateLeadUpdate(await readJson(request));
  if (fields.stage && fields.stage !== lead.stage) {
    fields.stageHistory = appendStageHistory(lead.stageHistory, {
      from: lead.stage, to: fields.stage, at: new Date().toISOString(), by: account.$id,
    });
  }
  const updated = await adminDatabases.updateDocument(DB_ID, CC.LEADS, lead.$id, fields);
  return { lead: updated };
});
