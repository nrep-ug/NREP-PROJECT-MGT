/**
 * Component API - Update and Delete
 * PATCH: Update a component (admin or project manager only)
 * DELETE: Delete a component (admin only)
 */

import { NextResponse } from 'next/server';
import { adminDatabases, adminUsers, adminTeams, DB_ID } from '@/lib/appwriteAdmin';
import { verifyAdminAccess } from '@/lib/authHelpers';

const COL_COMPONENTS = 'pms_project_components';
const COL_PROJECTS = 'pms_projects';

/**
 * Check if requester can manage a component (admin OR project manager/owner)
 */
async function canManageComponent(componentId, requesterId) {
  if (!requesterId) return false;
  try {
    // Admins can always manage
    const isAdmin = await verifyAdminAccess(requesterId);
    if (isAdmin) return true;

    // Get the component's project
    const component = await adminDatabases.getDocument(DB_ID, COL_COMPONENTS, componentId);
    const project = await adminDatabases.getDocument(DB_ID, COL_PROJECTS, component.projectId);
    if (!project.projectTeamId) return false;

    // Check if user is a manager or owner in the project team
    const memberships = await adminTeams.listMemberships(project.projectTeamId);
    const userMembership = memberships.memberships.find(
      (m) => m.userId === requesterId && (m.roles.includes('manager') || m.roles.includes('owner'))
    );
    return !!userMembership;
  } catch (err) {
    console.error('[canManageComponent]', err);
    return false;
  }
}

export async function PATCH(request, { params }) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { name, description, leaderId, requesterId } = body;

        if (!id) {
            return NextResponse.json({ error: 'Component ID is required' }, { status: 400 });
        }

        if (!requesterId) {
            return NextResponse.json({ error: 'Unauthorized: requesterId is required' }, { status: 401 });
        }

        const allowed = await canManageComponent(id, requesterId);
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
        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const requesterId = searchParams.get('requesterId');

        if (!id) {
            return NextResponse.json({ error: 'Component ID is required' }, { status: 400 });
        }

        if (!requesterId) {
            return NextResponse.json({ error: 'Unauthorized: requesterId is required' }, { status: 401 });
        }

        const allowed = await canManageComponent(id, requesterId);
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
