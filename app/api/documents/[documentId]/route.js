/**
 * Document Management API
 * Operations on individual documents: update, delete, replace version
 */

import { NextResponse } from 'next/server';
import { adminDatabases, adminStorage, adminUsers, ID, Query, DB_ID, BUCKET_DOCS } from '@/lib/appwriteAdmin';
import { nowUTC } from '@/lib/date';

const COL_DOCUMENTS = 'pms_documents';
const COL_VERSIONS = 'pms_document_versions';
const COL_PROJECTS = 'pms_projects';

/**
 * Check if user can manage document (uploader, project manager, or admin)
 */
async function canManageDocument(documentId, requesterId) {
  try {
    // Get document
    const doc = await adminDatabases.getDocument(DB_ID, COL_DOCUMENTS, documentId);

    // Check if user is the uploader
    if (doc.uploaderId === requesterId) {
      return { allowed: true, document: doc };
    }

    // Check if user is admin
    const user = await adminUsers.get(requesterId);
    if (user.labels?.includes('admin')) {
      return { allowed: true, document: doc };
    }

    // Check if user is project manager
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
 * PATCH /api/documents/[documentId]
 * Update document metadata (rename, change permissions, move to folder)
 */
export async function PATCH(request, { params }) {
  try {
    const { documentId } = params;
    const body = await request.json();
    const {
      requesterId,
      title,
      category,
      isClientVisible,
      isStaffVisible,
      staffList,
      clientList,
      parentFolderId
    } = body;

    if (!requesterId) {
      return NextResponse.json(
        { error: 'requesterId is required' },
        { status: 400 }
      );
    }

    // Check permissions
    const { allowed } = await canManageDocument(documentId, requesterId);
    if (!allowed) {
      return NextResponse.json(
        { error: 'You do not have permission to modify this document' },
        { status: 403 }
      );
    }

    // Build updates object
    const updates = {};

    if (title !== undefined) updates.title = title;
    if (category !== undefined) updates.category = category;
    if (isClientVisible !== undefined) updates.isClientVisible = isClientVisible;
    if (isStaffVisible !== undefined) updates.isStaffVisible = isStaffVisible;
    if (staffList !== undefined) updates.staffList = staffList;
    if (clientList !== undefined) updates.clientList = clientList;
    if (parentFolderId !== undefined) updates.parentFolderId = parentFolderId || null;

    // Update the document
    const updatedDoc = await adminDatabases.updateDocument(
      DB_ID,
      COL_DOCUMENTS,
      documentId,
      updates
    );

    return NextResponse.json({
      success: true,
      document: updatedDoc
    });
  } catch (error) {
    console.error('[API /documents/[documentId] PATCH]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update document' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/documents/[documentId]
 * Delete document and all its versions (and associated files from storage)
 */
export async function DELETE(request, { params }) {
  try {
    const { documentId } = params;
    const { searchParams } = new URL(request.url);
    const requesterId = searchParams.get('requesterId');

    if (!requesterId) {
      return NextResponse.json(
        { error: 'requesterId is required' },
        { status: 400 }
      );
    }

    // Check permissions
    const { allowed } = await canManageDocument(documentId, requesterId);
    if (!allowed) {
      return NextResponse.json(
        { error: 'You do not have permission to delete this document' },
        { status: 403 }
      );
    }

    // Get all versions to delete associated files
    const versions = await adminDatabases.listDocuments(DB_ID, COL_VERSIONS, [
      Query.equal('documentId', documentId)
    ]);

    // Delete files from storage
    for (const version of versions.documents) {
      try {
        await adminStorage.deleteFile(BUCKET_DOCS, version.fileId);
      } catch (storageError) {
        console.error(`Failed to delete file ${version.fileId}:`, storageError);
        // Continue even if storage deletion fails
      }
    }

    // Delete all version records
    for (const version of versions.documents) {
      try {
        await adminDatabases.deleteDocument(DB_ID, COL_VERSIONS, version.$id);
      } catch (versionError) {
        console.error(`Failed to delete version record ${version.$id}:`, versionError);
      }
    }

    // Delete the document
    await adminDatabases.deleteDocument(DB_ID, COL_DOCUMENTS, documentId);

    return NextResponse.json({
      success: true,
      message: 'Document and all versions deleted successfully'
    });
  } catch (error) {
    console.error('[API /documents/[documentId] DELETE]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete document' },
      { status: 500 }
    );
  }
}
