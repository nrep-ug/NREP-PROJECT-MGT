/**
 * Districts used by Clean Cooking champions and companies (per project).
 * GET:  list districts
 * POST: add a district { name }
 */
import { adminDatabases, DB_ID, ID, Query } from '@/lib/appwriteAdmin';
import { CC, ccHandler, HttpError, listAll, readBody } from '@/lib/cleanCooking/service';
import { cleanText, nameKey } from '@/lib/cleanCooking/domain';

export const GET = ccHandler('read', async ({ params }) => {
  const districts = await listAll(CC.DISTRICTS, [Query.equal('projectId', params.projectId)]);
  districts.sort((a, b) => a.name.localeCompare(b.name));
  return { districts };
});

export const POST = ccHandler('write', async ({ request, context, params }) => {
  const body = await readBody(request);
  const raw = cleanText(body.name, 100);
  if (!raw) throw new HttpError(400, 'District name is required.', 'VALIDATION_ERROR');
  // Title-case so "KABALE", "kabale" and "Kabale" are one district.
  const name = raw.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase());

  const existing = await listAll(CC.DISTRICTS, [Query.equal('projectId', params.projectId)]);
  const match = existing.find((d) => nameKey(d.name) === nameKey(name));
  if (match) return { district: match, existed: true };

  const district = await adminDatabases.createDocument(DB_ID, CC.DISTRICTS, ID.unique(), {
    projectId: params.projectId,
    name,
    createdBy: context.accountId,
  });
  return { district };
}, { status: 201 });
