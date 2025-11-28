/**
 * Embeds API - Create and list embeds
 * GET: List embeds by project
 * POST: Create embed
 */

import { NextResponse } from 'next/server';
import { adminDatabases, ID, Query, DB_ID } from '@/lib/appwriteAdmin';
import { getProjectDocPermissions } from '@/lib/rbac';

const COL_EMBEDS = 'pms_embeds';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
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
    } = body;

    if (!projectId || !organizationId || !projectTeamId || !title || !url) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
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
        createdBy: createdBy || null,
      },
      permissions
    );

    return NextResponse.json({ embed }, { status: 201 });
  } catch (error) {
    console.error('[API /embeds POST]', error);
    return NextResponse.json({ error: error.message || 'Failed to create embed' }, { status: 500 });
  }
}
