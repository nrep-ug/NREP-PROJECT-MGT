/**
 * Document Version Upload API
 * POST: Upload new version to replace existing document
 */

import { NextResponse } from 'next/server';
import { adminDatabases, adminUsers, ID, Query, DB_ID } from '@/lib/appwriteAdmin';
import { nowUTC } from '@/lib/date';

const COL_DOCUMENTS = 'pms_documents';
const COL_VERSIONS = 'pms_document_versions';
const COL_PROJECTS = 'pms_projects';

/**
 * Check if user can manage document
 */
async function canManageDocument(documentId, requesterId) {
  try {
    const doc = await adminDatabases.getDocument(DB_ID, COL_DOCUMENTS, documentId);

    if (doc.uploaderId === requesterId) {
      return { allowed: true, document: doc };
    }

    const user = await adminUsers.get(requesterId);
    if (user.labels?.includes('admin')) {
      return { allowed: true, document: doc };
    }

    const project = await adminDatabases.getDocument(DB_ID, COL_PROJECTS, doc.projectId);
    if (project.projectTeamId) {
      const { adminTeams } = require('@/lib/appwriteAdmin');
      const memberships = await adminTeams.listMemberships(project.projectTeamId);
      const userMembership = memberships.memberships.find(
        m => m.userId === requesterId && m.roles.includes('manager')
      );
      if (userMembership) {
        return { allowed: true, document: doc };
      }
    }

    return { allowed: false, document: doc };
  } catch (error) {
    console.error('[canManageDocument]', error);
    throw error;
  }
}

/**
 * POST /api/documents/[documentId]/version
 * Upload new version (file should be uploaded to storage first)
 */
export async function POST(request, { params }) {
  try {
    const { documentId } = params;
    const body = await request.json();
    const {
      requesterId,
      fileId,
      mimeType,
      sizeBytes,
      checksumSha256
    } = body;

    if (!requesterId || !fileId || !mimeType || !sizeBytes) {
      return NextResponse.json(
        { error: 'requesterId, fileId, mimeType, and sizeBytes are required' },
        { status: 400 }
      );
    }

    // Check permissions
    const { allowed, document } = await canManageDocument(documentId, requesterId);
    if (!allowed) {
      return NextResponse.json(
        { error: 'You do not have permission to upload new versions for this document' },
        { status: 403 }
      );
    }

    // Get current version number
    const currentVersion = document.currentVersion || 1;
    const newVersionNo = currentVersion + 1;

    // Create new version record
    const version = await adminDatabases.createDocument(
      DB_ID,
      COL_VERSIONS,
      ID.unique(),
      {
        documentId,
        versionNo: newVersionNo,
        fileId,
        mimeType,
        sizeBytes,
        checksumSha256: checksumSha256 || null,
        uploadedBy: requesterId,
        uploadedAt: nowUTC()
      }
    );

    // Update document's current version
    const updatedDoc = await adminDatabases.updateDocument(
      DB_ID,
      COL_DOCUMENTS,
      documentId,
      {
        currentVersion: newVersionNo
      }
    );

    return NextResponse.json({
      success: true,
      document: updatedDoc,
      version
    });
  } catch (error) {
    console.error('[API /documents/[documentId]/version POST]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to upload new version' },
      { status: 500 }
    );
  }
}
