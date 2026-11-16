/**
 * GET /api/clean-cooking/[projectId]/summary
 * Dashboard figures: company EPC sales aggregates + champions per district.
 * Contains no personal data.
 */
import { Query } from '@/lib/appwriteAdmin';
import { CC, ccHandler, listAll } from '@/lib/cleanCooking/service';
import { summarizeCompanySales } from '@/lib/cleanCooking/domain';
import { summarizeFieldActivity } from '@/lib/cleanCooking/fieldDomain';

/** Field-report tables may not be deployed yet — treat a missing table as empty. */
const orEmpty = (promise) => promise.catch((error) => {
  if (error?.code === 404) return [];
  throw error;
});

export const GET = ccHandler('read', async ({ params }) => {
  const byProject = [Query.equal('projectId', params.projectId)];
  const [sales, companies, champions, fieldSales, leads, followups] = await Promise.all([
    listAll(CC.COMPANY_SALES, byProject),
    listAll(CC.COMPANIES, [...byProject, Query.select(['$id', 'name', 'status'])]),
    listAll(CC.CHAMPIONS, [...byProject, Query.select(['$id', 'district', 'status', 'phone', 'email'])]),
    orEmpty(listAll(CC.FIELD_SALES, [...byProject, Query.select(['$id', 'district', 'quantity', 'verificationStatus'])])),
    orEmpty(listAll(CC.LEADS, [...byProject, Query.select(['$id', 'district', 'stage'])])),
    orEmpty(listAll(CC.FOLLOWUPS, [...byProject, Query.select(['$id', 'saleId', 'usageStatus', 'conductedOn'])])),
  ]);

  const active = champions.filter((c) => c.status !== 'inactive');
  const districtMap = new Map();
  for (const c of active) {
    const row = districtMap.get(c.district) || { district: c.district, champions: 0, reachable: 0 };
    row.champions += 1;
    if (c.phone || c.email) row.reachable += 1;
    districtMap.set(c.district, row);
  }

  return {
    sales: summarizeCompanySales(sales, companies),
    field: summarizeFieldActivity({ sales: fieldSales, leads, followups }),
    companies: { total: companies.length, active: companies.filter((c) => c.status !== 'inactive').length },
    champions: {
      total: active.length,
      withContact: active.filter((c) => c.phone || c.email).length,
      byDistrict: [...districtMap.values()].sort((a, b) => b.champions - a.champions),
    },
  };
});
