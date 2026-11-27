/**
 * PATCH:  update a champion
 * DELETE: remove a champion (project owner/manager or admin). Prefer marking inactive.
 */
import { adminDatabases, DB_ID } from '@/lib/appwriteAdmin';
import { CC, ccHandler, getProjectDocument, readBody } from '@/lib/cleanCooking/service';
import { championFields } from '@/lib/cleanCooking/validation';
import { assertPhoneUnique } from '@/lib/cleanCooking/champions';

export const PATCH = ccHandler('write', async ({ request, params }) => {
  await getProjectDocument(CC.CHAMPIONS, params.championId, params.projectId, 'Champion');
  const fields = championFields(await readBody(request));
  if (fields.phone) await assertPhoneUnique(params.projectId, fields.phone, params.championId);
  const champion = await adminDatabases.updateDocument(DB_ID, CC.CHAMPIONS, params.championId, fields);
  return { champion };
});

export const DELETE = ccHandler('manage', async ({ params }) => {
  await getProjectDocument(CC.CHAMPIONS, params.championId, params.projectId, 'Champion');
  await adminDatabases.deleteDocument(DB_ID, CC.CHAMPIONS, params.championId);
  return { success: true };
});
