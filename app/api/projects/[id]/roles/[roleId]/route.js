/**
 * Individual Project Role API — Update and Delete
 * PATCH:  Update a role's name, description, color, permissions, etc.
 * DELETE: Delete a custom role (blocked if members are using it)
 */

import { NextResponse } from 'next/server';
import { COLLECTIONS, adminDatabases, adminTeams, Query, DB_ID } from '@/lib/appwriteAdmin';
import { verifyProjectMembership } from '@/lib/authHelpers';
import { authenticateRequest, forbidOtherOrganization } from '@/lib/routeAuth';

const COL_ROLES = COLLECTIONS.PROJECT_ROLES;
const COL_PROJECTS = COLLECTIONS.PROJECTS;

export async function PATCH(request, { params }) {
  try {
    const { context, response: authError } = await authenticateRequest(request);
    if (authError) return authError;

    const { id: projectId, roleId } = await params;
    const body = await request.json();
    const { name, description, color, permissions, priority, isStaffRole } = body;
    const requesterId = context.accountId;

    const project = await adminDatabases.getDocument(DB_ID, COL_PROJECTS, projectId);
    const orgError = forbidOtherOrganization(context, project.organizationId);
    if (orgError) return orgError;

    // Verify requester is org admin OR project manager/owner
    if (!context.isAdmin) {
      const isManager = await verifyProjectMembership(requesterId, project.projectTeamId, ['manager', 'owner']);
      if (!isManager) {
        return NextResponse.json({ error: 'Only admins or project managers can edit roles' }, { status: 403 });
      }
    }

    // Get the existing role to verify it belongs to this project
    const existingRole = await adminDatabases.getDocument(DB_ID, COL_ROLES, roleId);
    if (existingRole.projectId !== projectId) {
      return NextResponse.json({ error: 'Role does not belong to this project' }, { status: 403 });
    }

    // Build update payload — only update provided fields
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (color !== undefined) updateData.color = color;
    if (permissions !== undefined) updateData.permissions = permissions;
    if (priority !== undefined) updateData.priority = priority;
    if (isStaffRole !== undefined) updateData.isStaffRole = isStaffRole;

    // Don't allow changing the slug of default roles
    // (slug is never editable via this endpoint — always set at creation)

    const updatedRole = await adminDatabases.updateDocument(DB_ID, COL_ROLES, roleId, updateData);

    return NextResponse.json({ role: updatedRole });
  } catch (error) {
    console.error('[API /projects/[id]/roles/[roleId] PATCH]', error);
    if (error.code === 404) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }
    return NextResponse.json({ error: error.message || 'Failed to update role' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { context, response: authError } = await authenticateRequest(request);
    if (authError) return authError;

    const { id: projectId, roleId } = await params;
    const requesterId = context.accountId;

    // Verify requester is org admin OR project manager/owner
    const project = await adminDatabases.getDocument(DB_ID, COL_PROJECTS, projectId);
    const orgError = forbidOtherOrganization(context, project.organizationId);
    if (orgError) return orgError;
    if (!context.isAdmin) {
      const isManager = await verifyProjectMembership(requesterId, project.projectTeamId, ['manager', 'owner']);
      if (!isManager) {
        return NextResponse.json({ error: 'Only admins or project managers can delete roles' }, { status: 403 });
      }
    }

    // Get the role
    const role = await adminDatabases.getDocument(DB_ID, COL_ROLES, roleId);
    if (role.projectId !== projectId) {
      return NextResponse.json({ error: 'Role does not belong to this project' }, { status: 403 });
    }

    // Check if any team members are using this role
    const memberships = await adminTeams.listMemberships(project.projectTeamId);
    const membersUsingRole = memberships.memberships.filter(
      m => m.roles.includes(role.slug)
    );

    if (membersUsingRole.length > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete role "${role.name}" — ${membersUsingRole.length} team member(s) are currently assigned this role. Reassign them first.`,
          membersCount: membersUsingRole.length,
        },
        { status: 409 }
      );
    }

    await adminDatabases.deleteDocument(DB_ID, COL_ROLES, roleId);

    return NextResponse.json({ success: true, message: `Role "${role.name}" deleted` });
  } catch (error) {
    console.error('[API /projects/[id]/roles/[roleId] DELETE]', error);
    if (error.code === 404) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }
    return NextResponse.json({ error: error.message || 'Failed to delete role' }, { status: 500 });
  }
}
