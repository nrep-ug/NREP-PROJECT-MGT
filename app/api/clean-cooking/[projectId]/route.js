/**
 * Clean Cooking module status for a project.
 * GET:  { enabled, access } — used by the project page to show the tab.
 * POST: enable the module on this project (organization admins only).
 */
import { adminDatabases, DB_ID, ID, Query } from '@/lib/appwriteAdmin';
import { CC, ccHandler, HttpError, isModuleEnabled } from '@/lib/cleanCooking/service';
import { CLEAN_COOKING_MODULE_KEY } from '@/lib/cleanCooking/schema.cjs';

export const GET = ccHandler('read', async ({ params, access }) => ({
  enabled: await isModuleEnabled(params.projectId),
  access: { canWrite: access.canWrite, canManage: access.canManage },
}), { requireEnabled: false });

export const POST = ccHandler('manage', async ({ context, params }) => {
  if (!context.isAdmin) {
    throw new HttpError(403, 'Only administrators can enable Clean Cooking on a project.', 'ADMIN_REQUIRED');
  }
  let existing;
  try {
    existing = await adminDatabases.listDocuments(DB_ID, CC.PROJECT_MODULES, [
      Query.equal('projectId', params.projectId),
      Query.equal('moduleKey', CLEAN_COOKING_MODULE_KEY),
      Query.limit(1),
    ]);
  } catch (error) {
    if (error?.code === 404) {
      throw new HttpError(
        503,
        'The Clean Cooking database tables have not been created yet. Run "npm run schema:clean-cooking -- --apply" first.',
        'SCHEMA_MISSING'
      );
    }
    throw error;
  }
  if (existing.documents[0]) {
    await adminDatabases.updateDocument(DB_ID, CC.PROJECT_MODULES, existing.documents[0].$id, {
      enabled: true,
      enabledBy: context.accountId,
    });
  } else {
    await adminDatabases.createDocument(DB_ID, CC.PROJECT_MODULES, ID.unique(), {
      projectId: params.projectId,
      moduleKey: CLEAN_COOKING_MODULE_KEY,
      enabled: true,
      enabledBy: context.accountId,
    });
  }
  return { enabled: true };
}, { requireEnabled: false });
