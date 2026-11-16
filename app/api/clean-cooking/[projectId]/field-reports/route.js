/**
 * GET /api/clean-cooking/[projectId]/field-reports
 * Champion-submitted sales, leads and follow-ups for staff review.
 * Customer identity (name/phone) is only returned to staff who can write to
 * the project; read-only users see anonymised records.
 */
import { Query } from '@/lib/appwriteAdmin';
import { CC, ccHandler, listAll } from '@/lib/cleanCooking/service';

function anonymise(record, canSeeIdentity) {
  if (canSeeIdentity) return record;
  return { ...record, customerName: record.customerName ? 'hidden' : null, customerPhone: record.customerPhone ? 'hidden' : null };
}

export const GET = ccHandler('read', async ({ params, access }) => {
  const byProject = [Query.equal('projectId', params.projectId)];
  const [sales, leads, followups, champions] = await Promise.all([
    listAll(CC.FIELD_SALES, [...byProject, Query.orderDesc('saleDate')]),
    listAll(CC.LEADS, [...byProject, Query.orderDesc('generatedOn')]),
    listAll(CC.FOLLOWUPS, [...byProject, Query.orderDesc('conductedOn')]),
    listAll(CC.CHAMPIONS, [...byProject, Query.select(['$id', 'fullName', 'district'])]),
  ]);
  const championNames = Object.fromEntries(champions.map((c) => [c.$id, c.fullName]));
  return {
    championNames,
    sales: sales.map((s) => anonymise(s, access.canWrite)),
    leads: leads.map((l) => anonymise({ ...l, stageHistory: undefined }, access.canWrite)),
    followups,
  };
});
