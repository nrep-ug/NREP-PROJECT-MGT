/**
 * GET /api/field/summary — champion home screen: counts + lists for forms
 * (brands and supplier companies to choose from).
 */
import { Query } from '@/lib/appwriteAdmin';
import { FOLLOW_UP_AFTER_DAYS, OPEN_LEAD_STAGES } from '@/lib/cleanCooking/fieldOptions';
import { CC, fieldHandler, listAll } from '@/lib/cleanCooking/fieldService';

const DAY = 86_400_000;

export const GET = fieldHandler(async ({ champion }) => {
  const mine = [Query.equal('championId', champion.$id)];
  const [leads, sales, followups, companySales, companies] = await Promise.all([
    listAll(CC.LEADS, [...mine, Query.select(['$id', 'stage', 'followUpDate'])]),
    listAll(CC.FIELD_SALES, [...mine, Query.select(['$id', 'saleDate', 'quantity', 'consentFollowUp', 'verificationStatus', 'brand'])]),
    listAll(CC.FOLLOWUPS, [...mine, Query.select(['$id', 'saleId', 'usageStatus'])]),
    listAll(CC.COMPANY_SALES, [Query.equal('projectId', champion.projectId), Query.select(['$id', 'brand'])]),
    listAll(CC.COMPANIES, [Query.equal('projectId', champion.projectId), Query.equal('status', 'active'), Query.select(['$id', 'name'])]),
  ]);

  const now = Date.now();
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const followedUp = new Set(followups.filter((f) => f.usageStatus !== 'not_reached').map((f) => f.saleId));
  const followUpsDue = sales.filter((s) => s.consentFollowUp && s.verificationStatus !== 'rejected'
    && !followedUp.has(s.$id) && new Date(s.saleDate).getTime() + FOLLOW_UP_AFTER_DAYS * DAY <= now).length;
  const openLeads = leads.filter((l) => OPEN_LEAD_STAGES.includes(l.stage));

  return {
    counts: {
      openLeads: openLeads.length,
      leadsDueToday: openLeads.filter((l) => l.followUpDate && new Date(l.followUpDate).getTime() <= now + DAY).length,
      salesThisMonth: sales.filter((s) => new Date(s.saleDate) >= monthStart).reduce((n, s) => n + (s.quantity || 0), 0),
      salesTotal: sales.reduce((n, s) => n + (s.quantity || 0), 0),
      followUpsDue,
      followUpsDone: followups.length,
    },
    brands: [...new Set([...companySales.map((s) => s.brand), ...sales.map((s) => s.brand)])].sort((a, b) => a.localeCompare(b)),
    companies: companies.map((c) => ({ $id: c.$id, name: c.name })).sort((a, b) => a.name.localeCompare(b.name)),
  };
});
