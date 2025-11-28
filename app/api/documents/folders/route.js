/**
 * Document Folders API
 * CRUD operations for document folders within projects
 */

import { NextResponse } from 'next/server';
import { adminDatabases, adminUsers, ID, Query, DB_ID } from '@/lib/appwriteAdmin';
import { nowUTC } from '@/lib/date';

const COL_FOLDERS = 'pms_document_folders';
const COL_DOCUMENTS = 'pms_documents';
const COL_PROJECTS = 'pms_projects';

/**
 * Check if user has access to a folder
 */
function hasAccess(folder, userId, isAdmin, isClient) {
  // Admins can see everything
  if (isAdmin) return true;

  if (isClient) {
    // Client access: isClientVisible OR in clientList
    return folder.isClientVisible || (folder.clientList && folder.clientList.includes(userId));
  } else {
    // Staff access: isStaffVisible OR in staffList
    return folder.isStaffVisible || (folder.staffList && folder.staffList.includes(userId));
  }
}

/**
 * Check if user has access to folder path (all parent folders)
 */
function hasAccessToFolderPath(folderId, userId, isAdmin, isClient, allFolders) {
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
    return hasAccessToFolderPath(folder.parentFolderId, userId, isAdmin, isClient, allFolders);
  }

  return true;
}

/**
 * GET /api/documents/folders
 * Get all folders for a project (filtered by permissions)
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const requesterId = searchParams.get('requesterId');
    const isClient = searchParams.get('isClient') === 'true';

    if (!projectId || !requesterId) {
      return NextResponse.json(
        { error: 'projectId and requesterId are required' },
        { status: 400 }
      );
    }

    // Determine if user is admin
    let isAdmin = false;
    try {
      const user = await adminUsers.get(requesterId);
      isAdmin = user.labels?.includes('admin') || false;
    } catch (error) {
      console.error('[API /documents/folders GET] Error checking admin status:', error);
    }

    // Fetch all folders for the project
    const folders = await adminDatabases.listDocuments(DB_ID, COL_FOLDERS, [
      Query.equal('projectId', projectId),
      Query.orderAsc('name')
    ]);

    // Filter folders based on permissions
    const filteredFolders = [];
    for (const folder of folders.documents) {
      // Check if user has access to this folder
      if (!hasAccess(folder, requesterId, isAdmin, isClient)) {
        continue;
      }

      // Check if user has access to parent folder path
      if (folder.parentFolderId) {
        const hasPathAccess = hasAccessToFolderPath(
          folder.parentFolderId,
          requesterId,
          isAdmin,
          isClient,
          folders.documents
        );
        if (!hasPathAccess) {
          continue;
        }
      }

      filteredFolders.push(folder);
    }

    return NextResponse.json({
      success: true,
      folders: filteredFolders
    });
  } catch (error) {
    console.error('[API /documents/folders GET]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch folders' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/documents/folders
 * Create a new folder
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      projectId,
      name,
      parentFolderId,
      createdBy,
      isClientVisible = false,
      isStaffVisible = true,
      staffList = [],
      clientList = []
    } = body;

    if (!projectId || !name || !createdBy) {
      return NextResponse.json(
        { error: 'projectId, name, and createdBy are required' },
        { status: 400 }
      );
    }

    // Check if folder with same name exists in same parent
    const existingFolders = await adminDatabases.listDocuments(DB_ID, COL_FOLDERS, [
      Query.equal('projectId', projectId),
      Query.equal('name', name),
      ...(parentFolderId ? [Query.equal('parentFolderId', parentFolderId)] : [])
    ]);

    if (existingFolders.documents.length > 0) {
      return NextResponse.json(
        { error: 'A folder with this name already exists in this location' },
        { status: 400 }
      );
    }

    // Create the folder
    const folder = await adminDatabases.createDocument(
      DB_ID,
      COL_FOLDERS,
      ID.unique(),
      {
        projectId,
        name,
        parentFolderId: parentFolderId || null,
        projectFolder: !parentFolderId, // Root level folder
        createdBy,
        modifiedBy: createdBy,
        isClientVisible,
        isStaffVisible,
        staffList,
        clientList
      }
    );

    return NextResponse.json({
      success: true,
      folder
    });
  } catch (error) {
    console.error('[API /documents/folders POST]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create folder' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/documents/folders
 * Update a folder (rename or change permissions)
 */
export async function PATCH(request) {
  try {
    const body = await request.json();
    const {
      folderId,
      requesterId,
      name,
      isClientVisible,
      isStaffVisible,
      staffList,
      clientList
    } = body;

    if (!folderId || !requesterId) {
      return NextResponse.json(
        { error: 'folderId and requesterId are required' },
        { status: 400 }
      );
    }

    // Get the folder
    const folder = await adminDatabases.getDocument(DB_ID, COL_FOLDERS, folderId);

    // Build updates object
    const updates = {
      modifiedBy: requesterId
    };

    if (name !== undefined) {
      // Check if new name conflicts with existing folders
      const existingFolders = await adminDatabases.listDocuments(DB_ID, COL_FOLDERS, [
        Query.equal('projectId', folder.projectId),
        Query.equal('name', name),
        ...(folder.parentFolderId ? [Query.equal('parentFolderId', folder.parentFolderId)] : []),
        Query.notEqual('$id', folderId)
      ]);

      if (existingFolders.documents.length > 0) {
        return NextResponse.json(
          { error: 'A folder with this name already exists in this location' },
          { status: 400 }
        );
      }

      updates.name = name;
    }

    if (isClientVisible !== undefined) updates.isClientVisible = isClientVisible;
    if (isStaffVisible !== undefined) updates.isStaffVisible = isStaffVisible;
    if (staffList !== undefined) updates.staffList = staffList;
    if (clientList !== undefined) updates.clientList = clientList;

    // Update the folder
    const updatedFolder = await adminDatabases.updateDocument(
      DB_ID,
      COL_FOLDERS,
      folderId,
      updates
    );

    return NextResponse.json({
      success: true,
      folder: updatedFolder
    });
  } catch (error) {
    console.error('[API /documents/folders PATCH]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update folder' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/documents/folders
 * Delete a folder (must be empty)
 */
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get('folderId');
    const requesterId = searchParams.get('requesterId');

    if (!folderId || !requesterId) {
      return NextResponse.json(
        { error: 'folderId and requesterId are required' },
        { status: 400 }
      );
    }

    // Check if folder has subfolders
    const subfolders = await adminDatabases.listDocuments(DB_ID, COL_FOLDERS, [
      Query.equal('parentFolderId', folderId),
      Query.limit(1)
    ]);

    if (subfolders.documents.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete folder with subfolders. Please delete subfolders first.' },
        { status: 400 }
      );
    }

    // Check if folder has documents
    const documents = await adminDatabases.listDocuments(DB_ID, COL_DOCUMENTS, [
      Query.equal('parentFolderId', folderId),
      Query.limit(1)
    ]);

    if (documents.documents.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete folder with documents. Please move or delete documents first.' },
        { status: 400 }
      );
    }

    // Delete the folder
    await adminDatabases.deleteDocument(DB_ID, COL_FOLDERS, folderId);

    return NextResponse.json({
      success: true,
      message: 'Folder deleted successfully'
    });
  } catch (error) {
    console.error('[API /documents/folders DELETE]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete folder' },
      { status: 500 }
    );
  }
}
