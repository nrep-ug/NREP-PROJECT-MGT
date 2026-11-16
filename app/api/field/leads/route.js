/**
 * Champion leads.
 * GET:  my leads (open first, then by follow-up date)
 * POST: record a new lead (idempotent on clientSubmissionId)
 */
import { Query } from '@/lib/appwriteAdmin';
import { appendStageHistory, validateLead } from '@/lib/cleanCooking/fieldDomain';
import { OPEN_LEAD_STAGES } from '@/lib/cleanCooking/fieldOptions';
import { CC, createOnce, fieldHandler, listAll, readJson, submissionStamp } from '@/lib/cleanCooking/fieldService';

export const GET = fieldHandler(async ({ champion }) => {
  const leads = await listAll(CC.LEADS, [Query.equal('championId', champion.$id), Query.orderDesc('$createdAt')]);
  const rank = (l) => (OPEN_LEAD_STAGES.includes(l.stage) ? 0 : 1);
  const due = (l) => (l.followUpDate ? new Date(l.followUpDate).getTime() : Number.MAX_SAFE_INTEGER);
  leads.sort((a, b) => rank(a) - rank(b) || due(a) - due(b));
  return { leads };
});

export const POST = fieldHandler(async ({ request, champion, account }) => {
  const fields = validateLead(await readJson(request));
  const { record, duplicate } = await createOnce(CC.LEADS, {
    ...submissionStamp(champion, account),
    ...fields,
    stageHistory: appendStageHistory('[]', { to: fields.stage, at: new Date().toISOString(), by: account.$id }),
  }, champion);
  return { lead: record, duplicate };
}, { status: 201 });
