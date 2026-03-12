import { NextResponse } from 'next/server';
import { adminTeams as teams, adminDatabases as databases, adminUsers, DB_ID } from '@/lib/appwriteAdmin';
import { verifyAdminAccess } from '@/lib/authHelpers';

const COLLECTIONS = {
  PROJECTS: 'pms_projects',
};

/**
 * PUT /api/projects/[id]/members/update-roles
 * Update a member's roles in the project team
 * Requires: requester must be admin OR project owner/manager
 */
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { membershipId, roles, requesterId, organizationId } = body;

    if (!membershipId || !roles || !Array.isArray(roles) || roles.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: membershipId and roles (non-empty array) are required' },
        { status: 400 }
      );
    }

    if (!requesterId || !organizationId) {
      return NextResponse.json(
        { error: 'Missing requesterId or organizationId' },
        { status: 400 }
      );
    }

    // Get project to find the project team ID
    const project = await databases.getDocument(DB_ID, COLLECTIONS.PROJECTS, id);

    if (!project || !project.projectTeamId) {
      return NextResponse.json(
        { error: 'Project or project team not found' },
        { status: 404 }
      );
    }

    // Verify requester has permission: must be org admin OR project manager/owner
    const isAdmin = await verifyAdminAccess(requesterId);
    if (!isAdmin) {
      // Check if they are a project manager or owner
      const memberships = await teams.listMemberships(project.projectTeamId);
      const requesterMembership = memberships.memberships.find(
        (m) => m.userId === requesterId &&
          (m.roles.includes('manager') || m.roles.includes('owner'))
      );
      if (!requesterMembership) {
        return NextResponse.json(
          { error: 'Forbidden: Only admins or project managers can update member roles' },
          { status: 403 }
        );
      }
    }

    // Validate roles to only allow known values
    const allowedRoles = ['owner', 'manager', 'contributor', 'viewer', 'client_rep'];
    const invalidRoles = roles.filter((r) => !allowedRoles.includes(r));
    if (invalidRoles.length > 0) {
      return NextResponse.json(
        { error: `Invalid roles: ${invalidRoles.join(', ')}. Allowed: ${allowedRoles.join(', ')}` },
        { status: 400 }
      );
    }

    // Update membership roles
    const updatedMembership = await teams.updateMembershipRoles(
      project.projectTeamId,
      membershipId,
      roles
    );

    return NextResponse.json({
      success: true,
      membership: updatedMembership
    });
  } catch (error) {
    console.error('Error updating member roles:', error);

    if (error.code === 404) {
      return NextResponse.json(
        { error: 'Membership not found' },
        { status: 404 }
      );
    }

    if (error.code === 401) {
      return NextResponse.json(
        { error: 'Unauthorized to update member roles' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to update member roles' },
      { status: 500 }
    );
  }
}
