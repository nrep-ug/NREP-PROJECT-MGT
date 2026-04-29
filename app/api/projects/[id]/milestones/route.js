/**
 * Project Milestones API
 * POST: Create a new milestone (activity schedule)
 * GET: Fetch milestones for a specific project
 * DELETE: Delete a milestone (activity schedule)
 */

import { NextResponse } from 'next/server';
import { COLLECTIONS, adminDatabases, DB_ID, ID, Query } from '@/lib/appwriteAdmin';
import { verifyStaffAccess, verifyAdminAccess, verifyProjectAccess } from '@/lib/authHelpers';
import { getProjectDocPermissions } from '@/lib/rbac';

const COL_MILESTONES = COLLECTIONS.MILESTONES;
const COL_PROJECTS = COLLECTIONS.PROJECTS;
const COL_TASKS = COLLECTIONS.TASKS;

export async function POST(request, { params }) {
  try {
    const { id: projectId } = await params;
    const body = await request.json();
    const {
      name,
      description,
      status,
      startDate,
      dueDate,
      actualDueDate,
      components,
      createdBy
    } = body;

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    if (!name || !createdBy) {
      return NextResponse.json({ error: 'Name and createdBy are required' }, { status: 400 });
    }

    // Optional: Verify user has access to create milestone
    const isStaff = await verifyStaffAccess(createdBy);
    if (!isStaff) {
      return NextResponse.json({ error: 'Forbidden: Only staff members can create milestones' }, { status: 403 });
    }

    // Get project details to set correct permissions
    const project = await adminDatabases.getDocument(DB_ID, COL_PROJECTS, projectId);
    
    // Generate RBAC permissions
    const permissions = getProjectDocPermissions(project.organizationId, project.projectTeamId);

    // Create the milestone
    const milestone = await adminDatabases.createDocument(
      DB_ID,
      COL_MILESTONES,
      ID.unique(),
      {
        projectId,
        name,
        description: description || null,
        status: status || 'open',
        startDate: startDate || null,
        dueDate: dueDate || null,
        actualDueDate: actualDueDate || null,
        components: components || [],
        createdBy,
      },
      permissions
    );

    return NextResponse.json({ success: true, milestone }, { status: 201 });
  } catch (error) {
    console.error('[API /projects/[id]/milestones POST]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create milestone' },
      { status: 500 }
    );
  }
}

export async function GET(request, { params }) {
  try {
    const { id: projectId } = await params;
    const { searchParams } = new URL(request.url);
    const requesterId = searchParams.get('requesterId');

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    if (!requesterId) {
      return NextResponse.json({ error: 'Unauthorized: requesterId is required' }, { status: 401 });
    }

    const isStaff = await verifyStaffAccess(requesterId);
    if (!isStaff) {
      return NextResponse.json({ error: 'Forbidden: Only staff members can view milestones' }, { status: 403 });
    }

    const milestonesResponse = await adminDatabases.listDocuments(
      DB_ID,
      COL_MILESTONES,
      [
        Query.equal('projectId', projectId),
        Query.orderAsc('startDate')
      ]
    );

    return NextResponse.json({
      milestones: milestonesResponse.documents,
      total: milestonesResponse.total
    });
  } catch (error) {
    console.error('[API /projects/[id]/milestones GET]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch milestones' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/projects/[id]/milestones
 * Update a milestone. Only allowed for: system admins, project managers, or the creator.
 */
export async function PUT(request, { params }) {
  try {
    const { id: projectId } = await params;
    const body = await request.json();
    const {
      milestoneId,
      name,
      description,
      status,
      startDate,
      dueDate,
      actualDueDate,
      components,
      updatedBy
    } = body;

    if (!projectId || !milestoneId || !updatedBy) {
      return NextResponse.json(
        { error: 'projectId, milestoneId, and updatedBy are required' },
        { status: 400 }
      );
    }

    // Fetch the milestone to check ownership
    const milestone = await adminDatabases.getDocument(DB_ID, COL_MILESTONES, milestoneId);

    if (milestone.projectId !== projectId) {
      return NextResponse.json({ error: 'Milestone does not belong to this project' }, { status: 400 });
    }

    // Authorization: admin, project manager, or creator
    const isAdmin = await verifyAdminAccess(updatedBy);
    const project = await adminDatabases.getDocument(DB_ID, COL_PROJECTS, projectId);
    const isProjectManager = await verifyProjectAccess(updatedBy, project.projectTeamId, ['owner', 'manager']);
    const isCreator = milestone.createdBy === updatedBy;

    if (!isAdmin && !isProjectManager && !isCreator) {
      return NextResponse.json(
        { error: 'Forbidden: Only system admins, project managers, or the creator can update this activity schedule' },
        { status: 403 }
      );
    }

    // Update the milestone
    const updatedMilestone = await adminDatabases.updateDocument(
      DB_ID,
      COL_MILESTONES,
      milestoneId,
      {
        name,
        description: description || null,
        status,
        startDate: startDate || null,
        dueDate: dueDate || null,
        actualDueDate: actualDueDate || null,
        components: components || [],
        updatedBy,
      }
    );

    return NextResponse.json({ success: true, milestone: updatedMilestone });
  } catch (error) {
    console.error('[API /projects/[id]/milestones PUT]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update activity schedule' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/[id]/milestones?milestoneId=xxx&requesterId=xxx
 * Delete a milestone. Only allowed for: system admins, project managers, or the creator.
 * Will refuse if the milestone has linked tasks.
 */
export async function DELETE(request, { params }) {
  try {
    const { id: projectId } = await params;
    const { searchParams } = new URL(request.url);
    const milestoneId = searchParams.get('milestoneId');
    const requesterId = searchParams.get('requesterId');

    if (!projectId || !milestoneId || !requesterId) {
      return NextResponse.json(
        { error: 'projectId, milestoneId, and requesterId are required' },
        { status: 400 }
      );
    }

    // Fetch the milestone to check ownership
    const milestone = await adminDatabases.getDocument(DB_ID, COL_MILESTONES, milestoneId);

    if (milestone.projectId !== projectId) {
      return NextResponse.json({ error: 'Milestone does not belong to this project' }, { status: 400 });
    }

    // Authorization: admin, project manager, or creator
    const isAdmin = await verifyAdminAccess(requesterId);
    const project = await adminDatabases.getDocument(DB_ID, COL_PROJECTS, projectId);
    const isProjectManager = await verifyProjectAccess(requesterId, project.projectTeamId, ['owner', 'manager']);
    const isCreator = milestone.createdBy === requesterId;

    if (!isAdmin && !isProjectManager && !isCreator) {
      return NextResponse.json(
        { error: 'Forbidden: Only system admins, project managers, or the creator can delete this activity schedule' },
        { status: 403 }
      );
    }

    // Check for linked tasks — prevent deletion if any exist
    const linkedTasks = await adminDatabases.listDocuments(DB_ID, COL_TASKS, [
      Query.equal('milestoneId', milestoneId),
      Query.limit(1)
    ]);

    if (linkedTasks.total > 0) {
      return NextResponse.json(
        { error: 'Cannot delete this activity schedule because it has linked tasks. Please remove or reassign the tasks first.' },
        { status: 409 }
      );
    }

    // Delete the milestone
    await adminDatabases.deleteDocument(DB_ID, COL_MILESTONES, milestoneId);

    return NextResponse.json({ success: true, message: 'Activity schedule deleted successfully' });
  } catch (error) {
    console.error('[API /projects/[id]/milestones DELETE]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete activity schedule' },
      { status: 500 }
    );
  }
}
