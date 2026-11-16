/**
 * Champion adoption follow-ups.
 * GET:  { due, upcoming, done } — my sales whose customers agreed to follow-up
 * POST: record a follow-up for one of my sales (idempotent)
 */
import { Query } from '@/lib/appwriteAdmin';
import { validateFollowUp } from '@/lib/cleanCooking/fieldDomain';
import { FOLLOW_UP_AFTER_DAYS } from '@/lib/cleanCooking/fieldOptions';
import { CC, createOnce, fieldHandler, getOwn, HttpError, listAll, readJson, submissionStamp } from '@/lib/cleanCooking/fieldService';

const DAY = 86_400_000;

export const GET = fieldHandler(async ({ champion }) => {
  const [sales, followups] = await Promise.all([
    listAll(CC.FIELD_SALES, [Query.equal('championId', champion.$id), Query.equal('consentFollowUp', true)]),
    listAll(CC.FOLLOWUPS, [Query.equal('championId', champion.$id), Query.orderDesc('conductedOn')]),
  ]);
  const doneSaleIds = new Set(followups.filter((f) => f.usageStatus !== 'not_reached').map((f) => f.saleId));
  const now = Date.now();
  const pending = sales
    .filter((s) => !doneSaleIds.has(s.$id) && s.verificationStatus !== 'rejected')
    .map((s) => {
      const dueAt = new Date(s.saleDate).getTime() + FOLLOW_UP_AFTER_DAYS * DAY;
      const attempts = followups.filter((f) => f.saleId === s.$id).length;
      return { sale: s, dueOn: new Date(dueAt).toISOString(), attempts };
    })
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn));
  return {
    followUpAfterDays: FOLLOW_UP_AFTER_DAYS,
    due: pending.filter((p) => new Date(p.dueOn).getTime() <= now),
    upcoming: pending.filter((p) => new Date(p.dueOn).getTime() > now),
    done: followups.slice(0, 50),
  };
});

export const POST = fieldHandler(async ({ request, champion, account }) => {
  const fields = validateFollowUp(await readJson(request));
  const sale = await getOwn(CC.FIELD_SALES, fields.saleId, champion, 'Sale');
  if (!sale.consentFollowUp) {
    throw new HttpError(409, 'This customer did not agree to be contacted again.', 'NO_FOLLOWUP_CONSENT');
  }
  const { record, duplicate } = await createOnce(CC.FOLLOWUPS, { ...submissionStamp(champion, account), ...fields }, champion);
  return { followUp: record, duplicate };
}, { status: 201 });
