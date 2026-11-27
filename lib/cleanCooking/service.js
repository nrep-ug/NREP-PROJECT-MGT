import { NextResponse } from 'next/server';
import { adminDatabases, adminTeams, COLLECTIONS, DB_ID, Query } from '@/lib/appwriteAdmin';
import { apiErrorResponse, HttpError, requireAuthenticatedContext } from '@/lib/serverAuth';
import { CLEAN_COOKING_COLLECTION_IDS, CLEAN_COOKING_MODULE_KEY } from './schema.cjs';

export const CC = CLEAN_COOKING_COLLECTION_IDS;
export { HttpError };

const WRITE_ROLES = ['owner', 'manager', 'lead', 'contributor'];
const MANAGE_ROLES = ['owner', 'manager'];

/** Page through every document matching the queries (Appwrite caps pages at 100). */
export async function listAll(collectionId, queries = []) {
  const documents = [];
  let cursor = null;
  for (;;) {
    const page = await adminDatabases.listDocuments(DB_ID, collectionId, [
      ...queries,
      Query.limit(100),
      ...(cursor ? [Query.cursorAfter(cursor)] : []),
    ]);
    documents.push(...page.documents);
    if (page.documents.length < 100) break;
    cursor = page.documents[page.documents.length - 1].$id;
  }
  return documents;
}

export async function isModuleEnabled(projectId) {
  try {
    const result = await adminDatabases.listDocuments(DB_ID, CC.PROJECT_MODULES, [
      Query.equal('projectId', projectId),
      Query.equal('moduleKey', CLEAN_COOKING_MODULE_KEY),
      Query.limit(1),
    ]);
    return Boolean(result.documents[0]?.enabled);
  } catch (error) {
    // Collection not deployed yet → module simply not available.
    if (error?.code === 404) return false;
    throw error;
  }
}

/**
 * Resolve the caller's Clean Cooking permissions on one project.
 * Identity comes only from the verified JWT context.
 *  - read:   org admin/manager, or any project team member except client_rep
 *  - write:  org admin/manager, or project owner/manager/lead/contributor
 *  - manage: org admin, or project owner/manager (deletes, enabling module)
 */
export async function resolveProjectAccess(context, projectId) {
  let project;
  try {
    project = await adminDatabases.getDocument(DB_ID, COLLECTIONS.PROJECTS, projectId);
  } catch (error) {
    if (error?.code === 404) throw new HttpError(404, 'Project not found.', 'NOT_FOUND');
    throw error;
  }
  if (project.organizationId !== context.organizationId) {
    throw new HttpError(403, 'This project belongs to another organization.', 'FORBIDDEN');
  }

  let projectRoles = [];
  if (project.projectTeamId) {
    try {
      const memberships = await adminTeams.listMemberships(project.projectTeamId, [
        Query.equal('userId', context.accountId),
        Query.limit(1),
      ]);
      projectRoles = memberships.memberships[0]?.roles || [];
    } catch (error) {
      if (error?.code !== 404) throw error;
    }
  }

  const isOrgLead = context.isAdmin || context.isManager;
  const isMember = projectRoles.length > 0 && !projectRoles.every((r) => r === 'client_rep');
  return {
    project,
    projectRoles,
    canRead: isOrgLead || isMember,
    canWrite: isOrgLead || projectRoles.some((r) => WRITE_ROLES.includes(r)),
    canManage: context.isAdmin || projectRoles.some((r) => MANAGE_ROLES.includes(r)),
  };
}

/**
 * Wrap a Clean Cooking route handler: authenticate, resolve project access,
 * require the module to be enabled and the given permission, map errors.
 *
 * @param {'read'|'write'|'manage'} need
 * @param {{ requireEnabled?: boolean, status?: number }} options
 */
export function ccHandler(need, handler, { requireEnabled = true, status = 200 } = {}) {
  return async (request, routeContext) => {
    try {
      const context = await requireAuthenticatedContext(request);
      const params = await routeContext.params;
      const access = await resolveProjectAccess(context, params.projectId);
      const allowed = need === 'read' ? access.canRead : need === 'write' ? access.canWrite : access.canManage;
      if (!allowed) {
        throw new HttpError(403, 'You do not have permission for this Clean Cooking action.', 'FORBIDDEN');
      }
      if (requireEnabled && !(await isModuleEnabled(params.projectId))) {
        throw new HttpError(404, 'Clean Cooking is not enabled for this project.', 'MODULE_DISABLED');
      }
      const result = await handler({ request, context, params, access });
      if (result instanceof NextResponse) return result;
      return NextResponse.json(result, { status });
    } catch (error) {
      const response = apiErrorResponse(error);
      if (response.status >= 500) console.error('[Clean Cooking API]', error);
      if (error?.code === 409 && !(error instanceof HttpError)) {
        return NextResponse.json({ error: 'A record with the same name already exists.' }, { status: 409 });
      }
      return NextResponse.json(response.body, { status: response.status });
    }
  };
}

export async function readBody(request) {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON.', 'INVALID_JSON');
  }
}

/** Fetch a document and make sure it belongs to the project in the URL. */
export async function getProjectDocument(collectionId, id, projectId, label = 'Record') {
  let document;
  try {
    document = await adminDatabases.getDocument(DB_ID, collectionId, id);
  } catch (error) {
    if (error?.code === 404) throw new HttpError(404, `${label} not found.`, 'NOT_FOUND');
    throw error;
  }
  if (document.projectId !== projectId) throw new HttpError(404, `${label} not found.`, 'NOT_FOUND');
  return document;
}
