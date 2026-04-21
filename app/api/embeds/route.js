/**
 * Embeds API - Create and list embeds
 * GET: List embeds by project
 * POST: Create embed
 * PATCH: Update embed
 * DELETE: Delete embed
 */

import { NextResponse } from 'next/server';
import { COLLECTIONS, adminDatabases, ID, Query, DB_ID } from '@/lib/appwriteAdmin';
import { getProjectDocPermissions } from '@/lib/rbac';
import { verifyStaffAccess } from '@/lib/authHelpers';

const COL_EMBEDS = COLLECTIONS.EMBEDS;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const requesterId = searchParams.get('requesterId');

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    if (!requesterId) {
      return NextResponse.json({ error: 'Unauthorized: requesterId is required' }, { status: 401 });
    }

    const isStaff = await verifyStaffAccess(requesterId);
    if (!isStaff) {
      return NextResponse.json({ error: 'Forbidden: Only staff members can view embeds' }, { status: 403 });
    }

    const response = await adminDatabases.listDocuments(DB_ID, COL_EMBEDS, [
      Query.equal('projectId', projectId),
    ]);

    return NextResponse.json({ embeds: response.documents, total: response.total });
  } catch (error) {
    console.error('[API /embeds GET]', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch embeds' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      projectId,
      organizationId,
      projectTeamId,
      title,
      provider,
      url,
      width,
      height,
      allowFullscreen,
      isClientVisible,
      createdBy,
      requesterId,
    } = body;
    const actorId = requesterId || createdBy;

    if (!projectId || !organizationId || !projectTeamId || !title || !url) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!actorId) {
      return NextResponse.json({ error: 'Unauthorized: requesterId is required' }, { status: 401 });
    }

    const isStaff = await verifyStaffAccess(actorId);
    if (!isStaff) {
      return NextResponse.json({ error: 'Forbidden: Only staff members can create embeds' }, { status: 403 });
    }

    // Validate URL is HTTPS for security
    if (!url.startsWith('https://')) {
      return NextResponse.json({ error: 'URL must be HTTPS' }, { status: 400 });
    }

    const permissions = getProjectDocPermissions(organizationId, projectTeamId);

    const embed = await adminDatabases.createDocument(
      DB_ID,
      COL_EMBEDS,
      ID.unique(),
      {
        projectId,
        title,
        provider: provider || '',
        url,
        width: width || 1000,
        height: height || 650,
        allowFullscreen: allowFullscreen !== undefined ? allowFullscreen : true,
        isClientVisible: isClientVisible !== undefined ? isClientVisible : false,
        createdBy: actorId,
      },
      permissions
    );

    return NextResponse.json({ embed }, { status: 201 });
  } catch (error) {
    console.error('[API /embeds POST]', error);
    return NextResponse.json({ error: error.message || 'Failed to create embed' }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const {
      embedId,
      title,
      provider,
      url,
      width,
      height,
      allowFullscreen,
      isClientVisible,
      requesterId,
    } = body;

    if (!embedId) {
      return NextResponse.json({ error: 'embedId is required' }, { status: 400 });
    }

    if (!requesterId) {
      return NextResponse.json({ error: 'Unauthorized: requesterId is required' }, { status: 401 });
    }

    const isStaff = await verifyStaffAccess(requesterId);
    if (!isStaff) {
      return NextResponse.json({ error: 'Forbidden: Only staff members can update embeds' }, { status: 403 });
    }

    if (!title || !url) {
      return NextResponse.json({ error: 'title and url are required' }, { status: 400 });
    }

    if (!url.startsWith('https://')) {
      return NextResponse.json({ error: 'URL must be HTTPS' }, { status: 400 });
    }

    const embed = await adminDatabases.updateDocument(
      DB_ID,
      COL_EMBEDS,
      embedId,
      {
        title,
        provider: provider || '',
        url,
        width: width || 1000,
        height: height || 650,
        allowFullscreen: allowFullscreen !== undefined ? allowFullscreen : true,
        isClientVisible: isClientVisible !== undefined ? isClientVisible : false,
      }
    );

    return NextResponse.json({ embed });
  } catch (error) {
    console.error('[API /embeds PATCH]', error);
    return NextResponse.json({ error: error.message || 'Failed to update embed' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const embedId = searchParams.get('embedId');
    const requesterId = searchParams.get('requesterId');

    if (!embedId) {
      return NextResponse.json({ error: 'embedId is required' }, { status: 400 });
    }

    if (!requesterId) {
      return NextResponse.json({ error: 'Unauthorized: requesterId is required' }, { status: 401 });
    }

    const isStaff = await verifyStaffAccess(requesterId);
    if (!isStaff) {
      return NextResponse.json({ error: 'Forbidden: Only staff members can delete embeds' }, { status: 403 });
    }

    await adminDatabases.deleteDocument(DB_ID, COL_EMBEDS, embedId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API /embeds DELETE]', error);
    return NextResponse.json({ error: error.message || 'Failed to delete embed' }, { status: 500 });
  }
}
