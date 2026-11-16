/**
 * Component API - Update and Delete
 * PATCH: Update a component (admin or project manager only)
 * DELETE: Delete a component (admin only)
 */

import { NextResponse } from 'next/server';
import { COLLECTIONS, adminDatabases, adminUsers, adminTeams, DB_ID } from '@/lib/appwriteAdmin';
import { authenticateRequest } from '@/lib/routeAuth';

const COL_COMPONENTS = COLLECTIONS.PROJECT_COMPONENTS;
const COL_PROJECTS = COLLECTIONS.PROJECTS;

/**
 * Check if the authenticated caller can manage a component
 * (admin of the component's organization OR project manager/owner/lead)
 */
async function canManageComponent(componentId, context) {
  const requesterId = context?.accountId;
  if (!requesterId) return false;
  try {
    // Get the component's project
    const component = await adminDatabases.getDocument(DB_ID, COL_COMPONENTS, componentId);
    const project = await adminDatabases.getDocument(DB_ID, COL_PROJECTS, component.projectId);
    if (project.organizationId && project.organizationId !== context.organizationId) return false;

    // Admins can always manage within their organization
    if (context.isAdmin) return true;
    if (!project.projectTeamId) return false;

    // Check if user is a manager, owner, or lead in the project team
    const memberships = await adminTeams.listMemberships(project.projectTeamId);
    const userMembership = memberships.memberships.find(
      (m) => m.userId === requesterId && (m.roles.includes('manager') || m.roles.includes('owner') || m.roles.includes('lead'))
    );
    return !!userMembership;
  } catch (err) {
    console.error('[canManageComponent]', err);
    return false;
  }
}

export async function PATCH(request, { params }) {
    try {
        const { context, response: authError } = await authenticateRequest(request);
        if (authError) return authError;

        const { id } = await params;
        const body = await request.json();
        const { name, description, leaderId } = body;

        if (!id) {
            return NextResponse.json({ error: 'Component ID is required' }, { status: 400 });
        }

        const allowed = await canManageComponent(id, context);
        if (!allowed) {
            return NextResponse.json({ error: 'Forbidden: Insufficient permissions to update this component' }, { status: 403 });
        }

        const updateData = {};
        if (name !== undefined) updateData.name = name.trim();
        if (description !== undefined) updateData.description = description?.trim() || null;
        if (leaderId !== undefined) updateData.leaderId = leaderId?.trim() || null;

        const component = await adminDatabases.updateDocument(
            DB_ID,
            COL_COMPONENTS,
            id,
            updateData
        );

        return NextResponse.json({ component }, { status: 200 });
    } catch (error) {
        console.error('[API /components/[id] PATCH]', error);
        return NextResponse.json({ error: error.message || 'Failed to update component' }, { status: 500 });
    }
}

export async function DELETE(request, { params }) {
    try {
        const { context, response: authError } = await authenticateRequest(request);
        if (authError) return authError;

        const { id } = await params;

        if (!id) {
            return NextResponse.json({ error: 'Component ID is required' }, { status: 400 });
        }

        const allowed = await canManageComponent(id, context);
        if (!allowed) {
            return NextResponse.json({ error: 'Forbidden: Insufficient permissions to delete this component' }, { status: 403 });
        }

        await adminDatabases.deleteDocument(
            DB_ID,
            COL_COMPONENTS,
            id
        );

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        console.error('[API /components/[id] DELETE]', error);
        return NextResponse.json({ error: error.message || 'Failed to delete component' }, { status: 500 });
    }
}
