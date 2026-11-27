/**
 * GET /api/clean-cooking
 * Projects in the caller's organization that have Clean Cooking enabled and
 * that the caller may read. Used by the sidebar entry to jump straight in.
 */
import { NextResponse } from 'next/server';
import { adminDatabases, DB_ID, Query } from '@/lib/appwriteAdmin';
import { apiErrorResponse, requireAuthenticatedContext } from '@/lib/serverAuth';
import { CC, resolveProjectAccess } from '@/lib/cleanCooking/service';
import { CLEAN_COOKING_MODULE_KEY } from '@/lib/cleanCooking/schema.cjs';

export async function GET(request) {
  try {
    const context = await requireAuthenticatedContext(request);
    let modules = [];
    try {
      const result = await adminDatabases.listDocuments(DB_ID, CC.PROJECT_MODULES, [
        Query.equal('moduleKey', CLEAN_COOKING_MODULE_KEY),
        Query.equal('enabled', true),
        Query.limit(100),
      ]);
      modules = result.documents;
    } catch (error) {
      if (error?.code !== 404) throw error;
    }

    const projects = [];
    for (const module of modules) {
      try {
        const access = await resolveProjectAccess(context, module.projectId);
        if (access.canRead) {
          projects.push({ $id: access.project.$id, code: access.project.code, name: access.project.name, status: access.project.status });
        }
      } catch {
        // Project in another organization, deleted, or not readable — skip it.
      }
    }
    return NextResponse.json({ projects });
  } catch (error) {
    const { status, body } = apiErrorResponse(error);
    if (status >= 500) console.error('[Clean Cooking list]', error);
    return NextResponse.json(body, { status });
  }
}
