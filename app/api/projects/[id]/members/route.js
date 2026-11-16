/**
 * Project Members API - Manage project team members
 * GET: List all members of a project team
 * POST: Add a member to a project team (manager/admin only)
 * DELETE: Remove a member from a project team (manager/admin only)
 */

import { NextResponse } from 'next/server';
import { COLLECTIONS, adminDatabases, adminTeams, Query, DB_ID } from '@/lib/appwriteAdmin';
const COL_ROLES = COLLECTIONS.PROJECT_ROLES;
import { verifyProjectAccess } from '@/lib/authHelpers';
import { authenticateRequest, forbidOtherOrganization, isStaffContext } from '@/lib/routeAuth';

const COL_PROJECTS = COLLECTIONS.PROJECTS;
const COL_USERS = COLLECTIONS.USERS;

/**
 * GET /api/projects/[id]/members
 * List all members of a project team
 */
export async function GET(request, { params }) {
  try {
    const { context, response: authError } = await authenticateRequest(request);
    if (authError) return authError;

    const { id } = await params;
    const projectId = id;

    if (!isStaffContext(context)) {
      return NextResponse.json({ error: 'Forbidden: Only staff members can view project members' }, { status: 403 });
    }

    // Get project to find its team ID
    const project = await adminDatabases.getDocument(DB_ID, COL_PROJECTS, projectId);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    const orgError = forbidOtherOrganization(context, project.organizationId);
    if (orgError) return orgError;

    // Get team memberships
    const memberships = await adminTeams.listMemberships(project.projectTeamId);

    // Get user profiles for each member
    const memberProfiles = await Promise.all(
      memberships.memberships.map(async (membership) => {
        try {
          const userProfiles = await adminDatabases.listDocuments(
            DB_ID,
            COL_USERS,
            [
              Query.equal('accountId', membership.userId),
              Query.limit(1)
            ]
          );

          if (userProfiles.documents.length > 0) {
            return {
              ...userProfiles.documents[0],
              projectRoles: membership.roles,
              membershipId: membership.$id
            };
          }
          return null;
        } catch (error) {
          console.error('Error fetching user profile:', error);
          return null;
        }
      })
    );

    // Filter out null values
    const validMembers = memberProfiles.filter(m => m !== null);

    return NextResponse.json({
      members: validMembers,
      total: validMembers.length
    });
  } catch (error) {
    console.error('[API /projects/[id]/members GET]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch project members' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/[id]/members
 * Add a staff member to a project team (manager/admin only)
 */
export async function POST(request, { params }) {
  try {
    const { context, response: authError } = await authenticateRequest(request);
    if (authError) return authError;

    const { id } = await params;
    const projectId = id;
    const body = await request.json();
    const {
      userId, // Account ID of the user to add
      roles, // Project roles to assign (e.g., ['contributor', 'viewer'])
    } = body;
    const requesterId = context.accountId;

    // Validate required fields
    if (!userId || !Array.isArray(roles) || roles.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, roles' },
        { status: 400 }
      );
    }

    // Validate roles dynamically against project roles in DB
    const projectRolesDocs = await adminDatabases.listDocuments(DB_ID, COL_ROLES, [
      Query.equal('projectId', projectId),
      Query.limit(100),
    ]);
    const validSlugs = projectRolesDocs.documents.map(r => r.slug);
    validSlugs.push('owner'); // system-level Appwrite team role
    const invalidRoles = roles.filter(role => !validSlugs.includes(role));
    if (invalidRoles.length > 0) {
      return NextResponse.json(
        { error: `Invalid roles: ${invalidRoles.join(', ')}` },
        { status: 400 }
      );
    }

    // Get project
    const project = await adminDatabases.getDocument(DB_ID, COL_PROJECTS, projectId);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    const orgError = forbidOtherOrganization(context, project.organizationId);
    if (orgError) return orgError;

    // Verify requester has manager access in org OR owner/manager role in project
    const isOrgManager = context.isManager;
    const isProjectManager = isOrgManager
      || await verifyProjectAccess(requesterId, project.projectTeamId, ['owner', 'manager']);

    if (!isOrgManager && !isProjectManager) {
      return NextResponse.json(
        { error: 'Forbidden: Only managers/admins can assign staff to projects' },
        { status: 403 }
      );
    }

    // Get user's email to add them to the team
    const userProfiles = await adminDatabases.listDocuments(
      DB_ID,
      COL_USERS,
      [
        Query.equal('accountId', userId),
        Query.limit(1)
      ]
    );

    if (userProfiles.documents.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userProfile = userProfiles.documents[0];
    if (userProfile.organizationId !== context.organizationId) {
      return NextResponse.json(
        { error: 'Forbidden: user belongs to another organization' },
        { status: 403 }
      );
    }

    // Add user to project team
    try {
      const membership = await adminTeams.createMembership(
        project.projectTeamId,
        roles,
        undefined, // email
        userId, // userId
        undefined, // phone
        undefined, // url
        `${userProfile.firstName} ${userProfile.lastName}`
      );

      return NextResponse.json({
        success: true,
        message: 'User added to project',
        membership
      }, { status: 201 });
    } catch (error) {
      if (error.code === 409) {
        return NextResponse.json(
          { error: 'User is already a member of this project' },
          { status: 409 }
        );
      }
      throw error;
    }
  } catch (error) {
    console.error('[API /projects/[id]/members POST]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to add member to project' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/[id]/members
 * Remove a staff member from a project team (manager/admin only)
 */
export async function DELETE(request, { params }) {
  try {
    const { context, response: authError } = await authenticateRequest(request);
    if (authError) return authError;

    const { id } = await params;
    const projectId = id;
    const { searchParams } = new URL(request.url);
    const membershipId = searchParams.get('membershipId');
    const requesterId = context.accountId;

    if (!membershipId) {
      return NextResponse.json(
        { error: 'Missing required parameter: membershipId' },
        { status: 400 }
      );
    }

    // Get project
    const project = await adminDatabases.getDocument(DB_ID, COL_PROJECTS, projectId);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    const orgError = forbidOtherOrganization(context, project.organizationId);
    if (orgError) return orgError;

    // Verify requester has manager access
    const isOrgManager = context.isManager;
    const isProjectManager = isOrgManager
      || await verifyProjectAccess(requesterId, project.projectTeamId, ['owner', 'manager']);

    if (!isOrgManager && !isProjectManager) {
      return NextResponse.json(
        { error: 'Forbidden: Only managers/admins can remove staff from projects' },
        { status: 403 }
      );
    }

    // Delete membership
    await adminTeams.deleteMembership(project.projectTeamId, membershipId);

    return NextResponse.json({
      success: true,
      message: 'Member removed from project'
    });
  } catch (error) {
    console.error('[API /projects/[id]/members DELETE]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to remove member from project' },
      { status: 500 }
    );
  }
}
