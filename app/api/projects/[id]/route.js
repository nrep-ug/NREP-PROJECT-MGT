/**
 * Single Project API - Get and Update
 * GET: Get project by ID
 * PATCH: Update project (safe fields only)
 */

import { NextResponse } from 'next/server';
import { adminDatabases, DB_ID } from '@/lib/appwriteAdmin';

const COL_PROJECTS = 'pms_projects';

export async function GET(request, { params }) {
  try {
    const { id } = await params;

    const project = await adminDatabases.getDocument(DB_ID, COL_PROJECTS, id);

    return NextResponse.json({ project });
  } catch (error) {
    console.error('[API /projects/[id] GET]', error);
    if (error.code === 404) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    return NextResponse.json({ error: error.message || 'Failed to fetch project' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Allow updating only safe fields
    const allowedFields = ['name', 'description', 'startDate', 'endDate', 'status', 'budgetAmount'];
    const updates = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const project = await adminDatabases.updateDocument(DB_ID, COL_PROJECTS, id, updates);

    return NextResponse.json({ project });
  } catch (error) {
    console.error('[API /projects/[id] PATCH]', error);
    if (error.code === 404) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    return NextResponse.json({ error: error.message || 'Failed to update project' }, { status: 500 });
  }
}
