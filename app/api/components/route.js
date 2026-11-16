/**
 * Components API - Create
 * POST: Create a new project component
 */

import { NextResponse } from 'next/server';
import { COLLECTIONS, adminDatabases, ID, DB_ID } from '@/lib/appwriteAdmin';
import { getProjectDocPermissions } from '@/lib/rbac';
import { verifyProjectMembership } from '@/lib/authHelpers';
import { authenticateRequest, forbidOtherOrganization, isStaffContext } from '@/lib/routeAuth';

const COL_COMPONENTS = COLLECTIONS.PROJECT_COMPONENTS;
const COL_PROJECTS = COLLECTIONS.PROJECTS;

export async function POST(request) {
    try {
        const { context, response: authError } = await authenticateRequest(request);
        if (authError) return authError;

        if (!isStaffContext(context)) {
            return NextResponse.json({ error: 'Forbidden: Only staff members can create components' }, { status: 403 });
        }

        const body = await request.json();
        const { projectId, name, description, leaderId } = body;

        if (!projectId || !name || !name.trim()) {
            return NextResponse.json({ error: 'projectId and name are required' }, { status: 400 });
        }

        // Team and organization come from the stored project, never from the request body,
        // so membership of one project cannot be used to write into another.
        const project = await adminDatabases.getDocument(DB_ID, COL_PROJECTS, projectId);
        const orgError = forbidOtherOrganization(context, project.organizationId);
        if (orgError) return orgError;
        const { organizationId, projectTeamId } = project;

        // Verify user is a member of this project team (or an admin)
        if (!context.isAdmin) {
            const isMember = await verifyProjectMembership(context.accountId, projectTeamId);
            if (!isMember) {
                return NextResponse.json({ error: 'Forbidden: You must be assigned to this project to create components' }, { status: 403 });
            }
        }

        // Get permissions (same as project)
        const permissions = getProjectDocPermissions(organizationId, projectTeamId);

        const componentData = {
            projectId,
            name: name.trim(),
            description: description?.trim() || null,
            leaderId: leaderId?.trim() || null
        };

        const component = await adminDatabases.createDocument(
            DB_ID,
            COL_COMPONENTS,
            ID.unique(),
            componentData,
            permissions
        );

        return NextResponse.json({ component }, { status: 201 });
    } catch (error) {
        console.error('[API /components POST]', error);
        return NextResponse.json({ error: error.message || 'Failed to create component' }, { status: 500 });
    }
}
