/**
 * Components API - Create
 * POST: Create a new project component
 */

import { NextResponse } from 'next/server';
import { adminDatabases, ID, DB_ID } from '@/lib/appwriteAdmin';
import { getProjectDocPermissions } from '@/lib/rbac';

const COL_COMPONENTS = 'pms_project_components';

export async function POST(request) {
    try {
        const body = await request.json();
        const {
            projectId,
            organizationId,
            projectTeamId,
            name,
            description,
            leaderId
        } = body;

        if (!projectId || !name || !name.trim()) {
            return NextResponse.json({ error: 'projectId and name are required' }, { status: 400 });
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
