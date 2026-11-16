/**
 * Projects API - List and Create
 * GET: List projects scoped by org
 * POST: Create project + create project team + set permissions (admin only)
 */

import { NextResponse } from 'next/server';
import { COLLECTIONS, adminDatabases, adminTeams, ID, Query, DB_ID } from '@/lib/appwriteAdmin';
import { authenticateRequest, isStaffContext } from '@/lib/routeAuth';
import { getProjectDocPermissions } from '@/lib/rbac';
import { getDefaultRoleDocuments } from '@/lib/projectRoles';

const COL_PROJECTS = COLLECTIONS.PROJECTS;
const COL_COMPONENTS = COLLECTIONS.PROJECT_COMPONENTS;
const COL_ROLES = COLLECTIONS.PROJECT_ROLES;

export async function GET(request) {
  try {
    const { context, response: authError } = await authenticateRequest(request);
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    // Always scope to the caller's own organization; a client-supplied value is ignored.
    const organizationId = context.organizationId;
    const status = searchParams.get('status');
    const clientId = searchParams.get('clientId');

    if (!isStaffContext(context)) {
      return NextResponse.json({ error: 'Forbidden: Only staff members can list projects' }, { status: 403 });
    }

    const queries = [Query.equal('organizationId', organizationId)];
    if (status) {
      queries.push(Query.equal('status', status));
    }
    if (clientId) {
      queries.push(Query.equal('clientId', clientId));
    }

    const response = await adminDatabases.listDocuments(DB_ID, COL_PROJECTS, queries);

    return NextResponse.json({ projects: response.documents, total: response.total });
  } catch (error) {
    console.error('[API /projects GET]', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch projects' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { context, response: authError } = await authenticateRequest(request);
    if (authError) return authError;

    if (!context.isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Only administrators can create projects' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      clientId,
      code,
      name,
      description,
      startDate,
      endDate,
      status,
      budgetAmount,
      budgetCurrency,
      components // Array of components to create
    } = body;
    // Organization and creator come from the verified session, never the body.
    const organizationId = context.organizationId;
    const createdBy = context.accountId;

    if (!code || !name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Create project team
    const projectTeamId = `proj_${code.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    try {
      await adminTeams.create(projectTeamId, `Project: ${name}`);
    } catch (error) {
      if (error.code !== 409) {
        throw error;
      }
      // Team already exists, continue
    }

    // 2. Create project document with permissions
    const permissions = getProjectDocPermissions(organizationId, projectTeamId);

    const projectData = {
      organizationId,
      clientId: clientId || null,
      projectTeamId,
      code,
      name,
      description: description || null,
      startDate: startDate || null,
      endDate: endDate || null,
      status: status || 'planned',
      budgetAmount: budgetAmount || 0,
      budgetCurrency: budgetCurrency || 'USD',
      createdBy,
    };

    const project = await adminDatabases.createDocument(
      DB_ID,
      COL_PROJECTS,
      ID.unique(),
      projectData,
      permissions
    );

    // 3. Add creator as project owner
    try {
      await adminTeams.createMembership(
        projectTeamId,
        ['owner'],
        undefined,  // email - not needed when using userId
        createdBy,  // userId
        undefined,  // phone
        undefined   // url
      );
    } catch (error) {
      // User might already be a member or doesn't exist yet
      // Silently continue if membership creation fails
    }

    // 4. Create project components if provided
    if (components && Array.isArray(components) && components.length > 0) {
      for (const component of components) {
        if (component.name && component.name.trim()) {
          try {
            await adminDatabases.createDocument(
              DB_ID,
              COL_COMPONENTS,
              ID.unique(),
              {
                projectId: project.$id,
                name: component.name.trim(),
                description: component.description?.trim() || null,
                leaderId: null // Not captured during project creation
              },
              permissions // Use same permissions as project
            );
          } catch (error) {
            console.error('[API /projects POST] Failed to create component:', error);
            // Continue creating other components even if one fails
          }
        }
      }
    }
    // 5. Seed default project roles
    try {
      const defaultRoleDocs = getDefaultRoleDocuments(project.$id, createdBy);
      for (const roleDoc of defaultRoleDocs) {
        await adminDatabases.createDocument(
          DB_ID,
          COL_ROLES,
          ID.unique(),
          roleDoc,
          permissions
        );
      }
    } catch (error) {
      console.error('[API /projects POST] Failed to seed default roles:', error);
      // Non-fatal — project was still created successfully
    }

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error('[API /projects POST]', error);
    return NextResponse.json({ error: error.message || 'Failed to create project' }, { status: 500 });
  }
}
