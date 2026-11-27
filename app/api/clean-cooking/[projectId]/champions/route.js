/**
 * Clean Cooking champions (field agents), each tied to one district.
 * GET:  list champions
 * POST: add a champion
 *
 * Phone and email are personal data: they are only returned to users who can
 * write to the project (staff running the programme), never to read-only users.
 */
import { adminDatabases, adminUsers, DB_ID, ID, Query } from '@/lib/appwriteAdmin';
import { CC, ccHandler, HttpError, listAll, readBody } from '@/lib/cleanCooking/service';
import { championFields } from '@/lib/cleanCooking/validation';
import { assertPhoneUnique, redactChampion } from '@/lib/cleanCooking/champions';

export const GET = ccHandler('read', async ({ params, access }) => {
  const champions = await listAll(CC.CHAMPIONS, [Query.equal('projectId', params.projectId)]);
  champions.sort((a, b) => a.district.localeCompare(b.district) || a.fullName.localeCompare(b.fullName));

  // Portal login status — only for staff who manage champions.
  const loginStatus = new Map();
  const accountIds = access.canWrite ? champions.map((c) => c.accountId).filter(Boolean) : [];
  for (let i = 0; i < accountIds.length; i += 100) {
    const page = await adminUsers.list([Query.equal('$id', accountIds.slice(i, i + 100)), Query.limit(100)]);
    for (const u of page.users) loginStatus.set(u.$id, { enabled: u.status !== false, lastSeen: u.accessedAt || null });
  }

  return {
    champions: champions.map((c) => ({
      ...redactChampion(c, access.canWrite),
      login: access.canWrite
        ? (c.accountId ? (loginStatus.get(c.accountId) || { enabled: false, missing: true }) : null)
        : undefined,
    })),
  };
});

export const POST = ccHandler('write', async ({ request, context, params }) => {
  const fields = championFields(await readBody(request));
  if (!fields.fullName || !fields.district) {
    throw new HttpError(400, 'Full name and district are required.', 'VALIDATION_ERROR');
  }
  await assertPhoneUnique(params.projectId, fields.phone);
  const champion = await adminDatabases.createDocument(DB_ID, CC.CHAMPIONS, ID.unique(), {
    projectId: params.projectId,
    status: 'active',
    gender: 'unspecified',
    isDistrictLead: false,
    ...fields,
    createdBy: context.accountId,
  });
  return { champion };
}, { status: 201 });
