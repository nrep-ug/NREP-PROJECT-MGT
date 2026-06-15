/**
 * Project Roles API — List and Create
 * GET:  List all roles for a project
 * POST: Create a new custom role (admin or project manager only)
 */

import { NextResponse } from 'next/server';
import { COLLECTIONS, adminDatabases, ID, Query, DB_ID } from '@/lib/appwriteAdmin';
import { verifyStaffAccess, verifyProjectMembership } from '@/lib/authHelpers';

const COL_ROLES = COLLECTIONS.PROJECT_ROLES;
const COL_PROJECTS = COLLECTIONS.PROJECTS;

export async function GET(request, { params }) {
  try {
    const { id: projectId } = await params;
    const { searchParams } = new URL(request.url);
    const requesterId = searchParams.get('requesterId');

    if (!requesterId) {
      return NextResponse.json({ error: 'requesterId is required' }, { status: 401 });
    }

    const isStaff = await verifyStaffAccess(requesterId);
    if (!isStaff) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const roles = await adminDatabases.listDocuments(DB_ID, COL_ROLES, [
      Query.equal('projectId', projectId),
      Query.orderDesc('priority'),
      Query.limit(100),
    ]);

    return NextResponse.json({ roles: roles.documents, total: roles.total });
  } catch (error) {
    console.error('[API /projects/[id]/roles GET]', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch roles' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const { id: projectId } = await params;
    const body = await request.json();
    const { slug, name, description, color, permissions, priority, isStaffRole, requesterId } = body;

    if (!requesterId) {
      return NextResponse.json({ error: 'requesterId is required' }, { status: 401 });
    }
    if (!slug || !name) {
      return NextResponse.json({ error: 'slug and name are required' }, { status: 400 });
    }

    // Verify requester is admin or project manager
    const project = await adminDatabases.getDocument(DB_ID, COL_PROJECTS, projectId);
    const isManager = await verifyProjectMembership(requesterId, project.projectTeamId, ['manager', 'owner']);
    if (!isManager) {
      return NextResponse.json({ error: 'Only admins or project managers can create roles' }, { status: 403 });
    }

    // Check slug uniqueness within the project
    const existing = await adminDatabases.listDocuments(DB_ID, COL_ROLES, [
      Query.equal('projectId', projectId),
      Query.equal('slug', slug),
      Query.limit(1),
    ]);
    if (existing.total > 0) {
      return NextResponse.json({ error: `A role with slug "${slug}" already exists in this project` }, { status: 409 });
    }

    const roleDoc = await adminDatabases.createDocument(DB_ID, COL_ROLES, ID.unique(), {
      projectId,
      slug,
      name,
      description: description || null,
      color: color || '#6c757d',
      permissions: permissions || [],
      priority: priority ?? 50,
      isDefault: false,
      isStaffRole: isStaffRole !== false,
      createdBy: requesterId,
    });

    return NextResponse.json({ role: roleDoc }, { status: 201 });
  } catch (error) {
    console.error('[API /projects/[id]/roles POST]', error);
    return NextResponse.json({ error: error.message || 'Failed to create role' }, { status: 500 });
  }
}
