/**
 * Single Project API - Get, Update, Delete
 * GET: Get project by ID
 * PATCH: Update project (safe fields only, admin or project manager only)
 * DELETE: Delete project and all related data (admin only)
 */

import { NextResponse } from 'next/server';
import { COLLECTIONS, adminDatabases, adminTeams, adminStorage, DB_ID, BUCKET_VERSIONS, Query } from '@/lib/appwriteAdmin';
import { verifyAdminAccess, verifyStaffAccess } from '@/lib/authHelpers';

const COL_PROJECTS = COLLECTIONS.PROJECTS;
const COL_PROJECT_COMPONENTS = COLLECTIONS.PROJECT_COMPONENTS;
const COL_MILESTONES = COLLECTIONS.MILESTONES;
const COL_TASKS = COLLECTIONS.TASKS;
const COL_TASK_ASSIGNMENTS = COLLECTIONS.TASK_ASSIGNMENTS;
const COL_TASK_COMMENTS = COLLECTIONS.TASK_COMMENTS;
const COL_TIMESHEET_ENTRIES = COLLECTIONS.TIMESHEET_ENTRIES;
const COL_DOCUMENTS = COLLECTIONS.DOCUMENTS;
const COL_DOCUMENT_VERSIONS = COLLECTIONS.DOCUMENT_VERSIONS;
const COL_DOCUMENT_FOLDERS = COLLECTIONS.DOCUMENT_FOLDERS;
const COL_EMBEDS = COLLECTIONS.EMBEDS;

export async function GET(request, { params }) {
// ... keep existing GET untouched
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const requesterId = searchParams.get('requesterId');

    if (!requesterId) {
      return NextResponse.json({ error: 'Unauthorized: requesterId is required' }, { status: 401 });
    }

    const isStaff = await verifyStaffAccess(requesterId);
    if (!isStaff) {
      return NextResponse.json({ error: 'Forbidden: Only staff members can view projects' }, { status: 403 });
    }

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
// ... keep existing PATCH untouched
  try {
    const { id } = await params;
    const body = await request.json();
    const { requesterId } = body;

    if (!requesterId) {
      return NextResponse.json({ error: 'Unauthorized: requesterId is required' }, { status: 401 });
    }

    // Verify requester is admin or project manager/owner
    const isAdmin = await verifyAdminAccess(requesterId);
    if (!isAdmin) {
      // Check project team membership for manager/owner role
      const project = await adminDatabases.getDocument(DB_ID, COL_PROJECTS, id);
      if (project.projectTeamId) {
        const memberships = await adminTeams.listMemberships(project.projectTeamId);
        const requesterMembership = memberships.memberships.find(
          (m) => m.userId === requesterId &&
            (m.roles.includes('manager') || m.roles.includes('owner'))
        );
        if (!requesterMembership) {
          return NextResponse.json(
            { error: 'Forbidden: Only admins or project managers can update projects' },
            { status: 403 }
          );
        }
      } else {
        return NextResponse.json(
          { error: 'Forbidden: Only admins or project managers can update projects' },
          { status: 403 }
        );
      }
    }

    // Allow updating only safe fields
    const allowedFields = ['name', 'description', 'startDate', 'endDate', 'status', 'budgetAmount', 'budgetCurrency', 'clientId', 'fundingPartners', 'implementingPartners', 'technologies', 'themes'];
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

// Helper to batch process fetching & deleting/updating
async function processByQuery(collection, queries, action) {
  let hasMore = true;
  while (hasMore) {
    const res = await adminDatabases.listDocuments(DB_ID, collection, [...queries, Query.limit(100)]);
    if (res.documents.length === 0) {
      hasMore = false;
      break;
    }
    for (const doc of res.documents) {
      await action(doc);
    }
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const requesterId = searchParams.get('requesterId');

    if (!requesterId) {
      return NextResponse.json({ error: 'Unauthorized: requesterId is required' }, { status: 401 });
    }

    const isAdmin = await verifyAdminAccess(requesterId);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden: Only administrators can delete projects via this API' }, { status: 403 });
    }

    let project;
    try {
      project = await adminDatabases.getDocument(DB_ID, COL_PROJECTS, id);
    } catch (err) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // 1. Delete associated Document Versions files & records
    const docQueryObject = [Query.equal('projectId', id)];
    await processByQuery(COL_DOCUMENTS, docQueryObject, async (doc) => {
        // Find document versions for this document and delete the physical files from storage
        await processByQuery(COL_DOCUMENT_VERSIONS, [Query.equal('documentId', doc.$id)], async (version) => {
            if (version.fileId) {
                try {
                    await adminStorage.deleteFile(BUCKET_VERSIONS, version.fileId);
                } catch (storageErr) {
                    console.warn(`[CascadeDelete] Failed to delete file ${version.fileId}:`, storageErr.message);
                }
            }
            await adminDatabases.deleteDocument(DB_ID, COL_DOCUMENT_VERSIONS, version.$id);
        });
        // Delete the core document record
        await adminDatabases.deleteDocument(DB_ID, COL_DOCUMENTS, doc.$id);
    });

    // 2. Cascade delete tasks, task assignments, and task comments
    await processByQuery(COL_TASKS, [Query.equal('projectId', id)], async (task) => {
        // Task assignments
        await processByQuery(COL_TASK_ASSIGNMENTS, [Query.equal('taskId', task.$id)], async (assignment) => {
            await adminDatabases.deleteDocument(DB_ID, COL_TASK_ASSIGNMENTS, assignment.$id);
        });
        // Task comments
        await processByQuery(COL_TASK_COMMENTS, [Query.equal('taskId', task.$id)], async (comment) => {
            await adminDatabases.deleteDocument(DB_ID, COL_TASK_COMMENTS, comment.$id);
        });
        // Delete task
        await adminDatabases.deleteDocument(DB_ID, COL_TASKS, task.$id);
    });

    // 3. Delete directly linked collections
    const collectionsToClear = [COL_PROJECT_COMPONENTS, COL_MILESTONES, COL_DOCUMENT_FOLDERS, COL_EMBEDS];
    for (const collection of collectionsToClear) {
        await processByQuery(collection, Object.freeze([Query.equal('projectId', id)]), async (doc) => {
            await adminDatabases.deleteDocument(DB_ID, collection, doc.$id);
        });
    }

    // 4. Update Timesheet Entries to disconnect them rather than deleting
    await processByQuery(COL_TIMESHEET_ENTRIES, [Query.equal('projectId', id)], async (entry) => {
        await adminDatabases.updateDocument(DB_ID, COL_TIMESHEET_ENTRIES, entry.$id, {
            projectId: 'deleted',
            notes: (entry.notes ? entry.notes + '\n' : '') + `[System Note: Originally attached to deleted project '${project.code}']`
        });
    });

    // 5. Delete Appwrite Team
    if (project.projectTeamId) {
        try {
            await adminTeams.delete(project.projectTeamId);
        } catch (teamErr) {
            console.warn(`[CascadeDelete] Failed to delete project team ${project.projectTeamId}:`, teamErr.message);
        }
    }

    // 6. Finally delete the project itself
    await adminDatabases.deleteDocument(DB_ID, COL_PROJECTS, id);

    return NextResponse.json({ success: true, message: 'Project and all related data successfully deleted' });
  } catch (error) {
    console.error('[API /projects/[id] DELETE Cascade]', error);
    return NextResponse.json({ error: error.message || 'Cascade deletion failed' }, { status: 500 });
  }
}
