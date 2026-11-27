/**
 * PATCH:  update a hub (the merged record is re-validated as a whole)
 * DELETE: delete a hub (project owner/manager or admin)
 */
import { adminDatabases, DB_ID } from '@/lib/appwriteAdmin';
import { CC, ccHandler, getProjectDocument, readBody } from '@/lib/cleanCooking/service';
import { assertUniqueHubName, HUB_EDITABLE_KEYS, hubFields } from '@/lib/cleanCooking/hubs';

export const PATCH = ccHandler('write', async ({ request, params }) => {
  const existing = await getProjectDocument(CC.HUBS, params.hubId, params.projectId, 'Hub');
  const body = await readBody(request);
  const merged = {};
  for (const key of HUB_EDITABLE_KEYS) merged[key] = body[key] !== undefined ? body[key] : existing[key];
  const fields = hubFields(merged);
  if (fields.name !== existing.name) await assertUniqueHubName(params.projectId, fields.name, params.hubId);
  const hub = await adminDatabases.updateDocument(DB_ID, CC.HUBS, params.hubId, fields);
  return { hub };
});

export const DELETE = ccHandler('manage', async ({ params }) => {
  await getProjectDocument(CC.HUBS, params.hubId, params.projectId, 'Hub');
  await adminDatabases.deleteDocument(DB_ID, CC.HUBS, params.hubId);
  return { success: true };
});
