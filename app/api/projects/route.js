/**
 * Projects API - List and Create
 * GET: List projects scoped by org
 * POST: Create project + create project team + set permissions (admin only)
 */

import { NextResponse } from 'next/server';
import { adminDatabases, adminTeams, ID, Query, DB_ID } from '@/lib/appwriteAdmin';
import { verifyAdminAccess } from '@/lib/authHelpers';
import { getProjectDocPermissions } from '@/lib/rbac';

const COL_PROJECTS = 'pms_projects';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const status = searchParams.get('status');

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    const queries = [Query.equal('organizationId', organizationId)];
    if (status) {
      queries.push(Query.equal('status', status));
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
    const body = await request.json();
    const {
      organizationId,
      clientId,
      code,
      name,
      description,
      startDate,
      endDate,
      status,
      budgetAmount,
      createdBy,
      requesterId // ID of the user making the request (for authorization)
    } = body;

    if (!organizationId || !code || !name || !createdBy) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify requester has admin access
    if (!requesterId) {
      return NextResponse.json(
        { error: 'Unauthorized: requesterId is required' },
        { status: 401 }
      );
    }

    const isAdmin = await verifyAdminAccess(requesterId);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Only administrators can create projects' },
        { status: 403 }
      );
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
        createdBy,
        undefined,
        undefined
      );
    } catch (error) {
      // User might already be a member or doesn't exist yet
      // Silently continue if membership creation fails
    }

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error('[API /projects POST]', error);
    return NextResponse.json({ error: error.message || 'Failed to create project' }, { status: 500 });
  }
}
