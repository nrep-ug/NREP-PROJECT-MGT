/**
 * Clean cooking hubs for a project.
 * GET:  list hubs + headline indicators
 * POST: add a hub
 */
import { adminDatabases, DB_ID, ID, Query } from '@/lib/appwriteAdmin';
import { CC, ccHandler, listAll, readBody } from '@/lib/cleanCooking/service';
import { summarizeHubs } from '@/lib/cleanCooking/hubDomain';
import { assertUniqueHubName, hubFields } from '@/lib/cleanCooking/hubs';

export const GET = ccHandler('read', async ({ params }) => {
  let hubs;
  try {
    hubs = await listAll(CC.HUBS, [Query.equal('projectId', params.projectId)]);
  } catch (error) {
    // Table not created yet → show an empty list rather than an error.
    if (error?.code === 404) return { hubs: [], summary: summarizeHubs([]), notDeployed: true };
    throw error;
  }
  hubs.sort((a, b) => a.district.localeCompare(b.district) || a.name.localeCompare(b.name));
  return { hubs, summary: summarizeHubs(hubs) };
});

export const POST = ccHandler('write', async ({ request, context, params }) => {
  const fields = hubFields(await readBody(request));
  await assertUniqueHubName(params.projectId, fields.name);
  const hub = await adminDatabases.createDocument(DB_ID, CC.HUBS, ID.unique(), {
    projectId: params.projectId,
    ...fields,
    createdBy: context.accountId,
  });
  return { hub };
}, { status: 201 });
