import { NextResponse } from 'next/server';
import { adminTeams as teams, adminDatabases as databases, DB_ID } from '@/lib/appwriteAdmin';

const COLLECTIONS = {
  PROJECTS: 'pms_projects',
};

/**
 * PUT /api/projects/[id]/members/update-roles
 * Update a member's roles in the project team
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

    // TODO: Verify requester has permission (is admin or project manager)
    // For now, we're checking this on the client side

    // Update membership roles
    // Note: Appwrite teams.updateMembershipRoles expects roles as an array of strings
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

    // Handle specific Appwrite errors
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
