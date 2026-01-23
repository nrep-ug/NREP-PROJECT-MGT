/**
 * Component API - Update and Delete
 * PATCH: Update a component
 * DELETE: Delete a component
 */

import { NextResponse } from 'next/server';
import { adminDatabases, DB_ID } from '@/lib/appwriteAdmin';

const COL_COMPONENTS = 'pms_project_components';

export async function PATCH(request, { params }) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { name, description, leaderId } = body;

        if (!id) {
            return NextResponse.json({ error: 'Component ID is required' }, { status: 400 });
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

        if (!id) {
            return NextResponse.json({ error: 'Component ID is required' }, { status: 400 });
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
