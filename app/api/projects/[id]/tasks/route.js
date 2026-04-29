/**
 * Project Tasks API
 * POST: Create a new task
 * GET: Fetch tasks for a specific project
 * DELETE: Delete a task
 */

import { NextResponse } from 'next/server';
import { COLLECTIONS, adminDatabases, Query, DB_ID, ID } from '@/lib/appwriteAdmin';
import { verifyStaffAccess, verifyAdminAccess, verifyProjectAccess } from '@/lib/authHelpers';
import { getProjectDocPermissions } from '@/lib/rbac';

const COL_TASKS = COLLECTIONS.TASKS;
const COL_PROJECTS = COLLECTIONS.PROJECTS;

export async function POST(request, { params }) {
  try {
    const { id: projectId } = await params;
    const body = await request.json();
    const {
      milestoneId,
      title,
      description,
      priority,
      status,
      estimatedHours,
      startDate,
      dueDate,
      assignedTo,
      createdBy
    } = body;

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    if (!title || !createdBy) {
      return NextResponse.json({ error: 'Title and createdBy are required' }, { status: 400 });
    }

    // Verify user has access
    const isStaff = await verifyStaffAccess(createdBy);
    if (!isStaff) {
      return NextResponse.json({ error: 'Forbidden: Only staff members can create tasks' }, { status: 403 });
    }

    // Get project details to set correct permissions
    const project = await adminDatabases.getDocument(DB_ID, COL_PROJECTS, projectId);
    
    // Generate RBAC permissions
    const permissions = getProjectDocPermissions(project.organizationId, project.projectTeamId);

    // Create the task
    const task = await adminDatabases.createDocument(
      DB_ID,
      COL_TASKS,
      ID.unique(),
      {
        projectId,
        milestoneId: milestoneId || null,
        title,
        description: description || null,
        priority: priority || 'medium',
        status: status || 'todo',
        estimatedHours: parseFloat(estimatedHours) || 0,
        startDate: startDate || null,
        dueDate: dueDate || null,
        assignedTo: assignedTo || [],
        createdBy,
      },
      permissions
    );

    return NextResponse.json({ success: true, task }, { status: 201 });
  } catch (error) {
    console.error('[API /projects/[id]/tasks POST]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create task' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/projects/[id]/tasks
 * Fetch all tasks for a project (for timesheet linking)
 */
export async function GET(request, { params }) {
  try {
    const { id: projectId } = await params;
    const { searchParams } = new URL(request.url);
    const includeCompleted = searchParams.get('includeCompleted') === 'true';
    const requesterId = searchParams.get('requesterId');

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    if (!requesterId) {
      return NextResponse.json({ error: 'Unauthorized: requesterId is required' }, { status: 401 });
    }

    const isStaff = await verifyStaffAccess(requesterId);
    if (!isStaff) {
      return NextResponse.json({ error: 'Forbidden: Only staff members can view tasks' }, { status: 403 });
    }

    // Build queries
    const queries = [Query.equal('projectId', projectId)];

    // By default, only show non-completed tasks for timesheet entry
    if (!includeCompleted) {
      queries.push(Query.notEqual('status', 'completed'));
    }

    queries.push(Query.orderDesc('$createdAt'));

    // Fetch tasks
    const tasksResponse = await adminDatabases.listDocuments(
      DB_ID,
      COL_TASKS,
      queries
    );

    return NextResponse.json({
      tasks: tasksResponse.documents,
      total: tasksResponse.total
    });
  } catch (error) {
    console.error('[API /projects/[id]/tasks GET]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/projects/[id]/tasks
 * Update a task. Only allowed for: system admins, project managers, task creator, or assigned users.
 */
export async function PUT(request, { params }) {
  try {
    const { id: projectId } = await params;
    const body = await request.json();
    const {
      taskId,
      milestoneId,
      title,
      description,
      priority,
      status,
      estimatedHours,
      startDate,
      dueDate,
      assignedTo,
      updatedBy
    } = body;

    if (!projectId || !taskId || !updatedBy) {
      return NextResponse.json(
        { error: 'projectId, taskId, and updatedBy are required' },
        { status: 400 }
      );
    }

    // Fetch the task to check ownership
    const task = await adminDatabases.getDocument(DB_ID, COL_TASKS, taskId);

    if (task.projectId !== projectId) {
      return NextResponse.json({ error: 'Task does not belong to this project' }, { status: 400 });
    }

    // Authorization: admin, project manager, creator, or assignee
    const isAdmin = await verifyAdminAccess(updatedBy);
    const project = await adminDatabases.getDocument(DB_ID, COL_PROJECTS, projectId);
    const isProjectManager = await verifyProjectAccess(updatedBy, project.projectTeamId, ['owner', 'manager']);
    const isCreator = task.createdBy === updatedBy;
    const isAssignee = task.assignedTo && task.assignedTo.includes(updatedBy);

    if (!isAdmin && !isProjectManager && !isCreator && !isAssignee) {
      return NextResponse.json(
        { error: 'Forbidden: Only system admins, project managers, the task creator, or assigned members can update this task' },
        { status: 403 }
      );
    }

    // Update the task
    const updatedTask = await adminDatabases.updateDocument(
      DB_ID,
      COL_TASKS,
      taskId,
      {
        milestoneId: milestoneId !== undefined ? milestoneId : task.milestoneId,
        title: title !== undefined ? title : task.title,
        description: description !== undefined ? description : task.description,
        priority: priority !== undefined ? priority : task.priority,
        status: status !== undefined ? status : task.status,
        estimatedHours: estimatedHours !== undefined ? parseFloat(estimatedHours) : task.estimatedHours,
        startDate: startDate !== undefined ? startDate : task.startDate,
        dueDate: dueDate !== undefined ? dueDate : task.dueDate,
        assignedTo: assignedTo !== undefined ? assignedTo : task.assignedTo,
        updatedBy,
      }
    );

    return NextResponse.json({ success: true, task: updatedTask });
  } catch (error) {
    console.error('[API /projects/[id]/tasks PUT]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update task' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/[id]/tasks?taskId=xxx&requesterId=xxx
 * Delete a task. Only allowed for: system admins, project managers, or the creator.
 */
export async function DELETE(request, { params }) {
  try {
    const { id: projectId } = await params;
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');
    const requesterId = searchParams.get('requesterId');

    if (!projectId || !taskId || !requesterId) {
      return NextResponse.json(
        { error: 'projectId, taskId, and requesterId are required' },
        { status: 400 }
      );
    }

    // Fetch the task to check ownership
    const task = await adminDatabases.getDocument(DB_ID, COL_TASKS, taskId);

    if (task.projectId !== projectId) {
      return NextResponse.json({ error: 'Task does not belong to this project' }, { status: 400 });
    }

    // Authorization: admin, project manager, or creator
    const isAdmin = await verifyAdminAccess(requesterId);
    const project = await adminDatabases.getDocument(DB_ID, COL_PROJECTS, projectId);
    const isProjectManager = await verifyProjectAccess(requesterId, project.projectTeamId, ['owner', 'manager']);
    const isCreator = task.createdBy === requesterId;

    if (!isAdmin && !isProjectManager && !isCreator) {
      return NextResponse.json(
        { error: 'Forbidden: Only system admins, project managers, or the creator can delete this task' },
        { status: 403 }
      );
    }

    // Delete the task
    await adminDatabases.deleteDocument(DB_ID, COL_TASKS, taskId);

    return NextResponse.json({ success: true, message: 'Task deleted successfully' });
  } catch (error) {
    console.error('[API /projects/[id]/tasks DELETE]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete task' },
      { status: 500 }
    );
  }
}
