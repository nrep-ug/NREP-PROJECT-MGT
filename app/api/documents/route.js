/**
 * Documents API - Register document and versions
 * GET: Fetch documents for a project
 * POST: Register document after Storage upload
 */

import { NextResponse } from 'next/server';
import { adminDatabases, adminUsers, ID, Query, DB_ID } from '@/lib/appwriteAdmin';
import { getProjectDocPermissions } from '@/lib/rbac';
import { nowUTC } from '@/lib/date';

const COL_DOCUMENTS = 'pms_documents';
const COL_VERSIONS = 'pms_document_versions';
const COL_FOLDERS = 'pms_document_folders';

/**
 * Check if user has access to a document/folder
 */
function hasAccess(item, userId, isAdmin, isClient) {
  // Admins can see everything
  if (isAdmin) return true;

  if (isClient) {
    // Client access: isClientVisible OR in clientList
    return item.isClientVisible || (item.clientList && item.clientList.includes(userId));
  } else {
    // Staff access: isStaffVisible OR in staffList
    return item.isStaffVisible || (item.staffList && item.staffList.includes(userId));
  }
}

/**
 * Check if user has access to folder path (all parent folders)
 */
async function hasAccessToFolderPath(folderId, userId, isAdmin, isClient, allFolders) {
  if (!folderId) return true; // Root level
  if (isAdmin) return true;

  const folder = allFolders.find(f => f.$id === folderId);
  if (!folder) return false;

  // Check access to this folder
  if (!hasAccess(folder, userId, isAdmin, isClient)) {
    return false;
  }

  // Recursively check parent folders
  if (folder.parentFolderId) {
    return await hasAccessToFolderPath(folder.parentFolderId, userId, isAdmin, isClient, allFolders);
  }

  return true;
}

/**
 * GET /api/documents
 * Fetch documents for a project, optionally filtered by folder
 * Now with permission filtering based on user role and access
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const parentFolderId = searchParams.get('parentFolderId');
    const requesterId = searchParams.get('requesterId');
    const isClient = searchParams.get('isClient') === 'true';

    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId is required' },
        { status: 400 }
      );
    }

    // Determine if user is admin
    let isAdmin = false;
    if (requesterId) {
      try {
        const user = await adminUsers.get(requesterId);
        isAdmin = user.labels?.includes('admin') || false;
      } catch (error) {
        console.error('[API /documents GET] Error checking admin status:', error);
      }
    }

    // Fetch all folders for the project (needed for permission checking)
    const allFolders = await adminDatabases.listDocuments(DB_ID, COL_FOLDERS, [
      Query.equal('projectId', projectId)
    ]);

    // Build query
    const queries = [
      Query.equal('projectId', projectId),
      Query.orderAsc('title')
    ];

    // Filter by folder (null for root level)
    if (parentFolderId === 'null' || parentFolderId === '') {
      // Root level documents (no parent folder)
      queries.push(Query.isNull('parentFolderId'));
    } else if (parentFolderId) {
      queries.push(Query.equal('parentFolderId', parentFolderId));
    }

    const documents = await adminDatabases.listDocuments(DB_ID, COL_DOCUMENTS, queries);

    // Filter documents based on permissions
    const filteredDocuments = [];
    for (const doc of documents.documents) {
      // Check if user has access to this document
      if (!hasAccess(doc, requesterId, isAdmin, isClient)) {
        continue;
      }

      // Check if user has access to parent folder path
      if (doc.parentFolderId) {
        const hasPathAccess = await hasAccessToFolderPath(
          doc.parentFolderId,
          requesterId,
          isAdmin,
          isClient,
          allFolders.documents
        );
        if (!hasPathAccess) {
          continue;
        }
      }

      filteredDocuments.push(doc);
    }

    return NextResponse.json({
      success: true,
      documents: filteredDocuments
    });
  } catch (error) {
    console.error('[API /documents GET]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}

/**
 * 
 * POST /api/documents
 * Register a new document and its initial version
 * Expects JSON body with document and version details
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      documentId,
      projectId,
      organizationId,
      projectTeamId,
      uploaderId,
      title,
      category,
      fileId,
      mimeType,
      sizeBytes,
      checksumSha256,
      parentFolderId,
      isClientVisible = false,
      isStaffVisible = true,
      staffList = [],
      clientList = []
    } = body;

    console.log('Registering document:', body);

    if ( !documentId || !projectId || !organizationId || !projectTeamId || !uploaderId || !title || !fileId || !mimeType || !sizeBytes) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const permissions = getProjectDocPermissions(organizationId, projectTeamId);

    // 1. Create document header
    const document = await adminDatabases.createDocument(
      DB_ID,
      COL_DOCUMENTS,
      ID.unique(),
      {
        documentId,
        projectId,
        uploaderId,
        title,
        category: category || 'other',
        currentVersion: 1,
        parentFolderId: parentFolderId || null,
        isClientVisible,
        isStaffVisible,
        staffList,
        clientList
      },
      permissions
    );

    // 2. Create version 1
    const version = await adminDatabases.createDocument(
      DB_ID,
      COL_VERSIONS,
      ID.unique(),
      {
        documentId: documentId,
        versionNo: 1,
        fileId,
        mimeType,
        sizeBytes,
        checksumSha256: checksumSha256 || null,
        uploadedBy: uploaderId,
        uploadedAt: nowUTC(),
      },
      permissions
    );

    return NextResponse.json({ document, version }, { status: 201 });
  } catch (error) {
    console.error('[API /documents POST]', error);
    return NextResponse.json({ error: error.message || 'Failed to register document' }, { status: 500 });
  }
}
