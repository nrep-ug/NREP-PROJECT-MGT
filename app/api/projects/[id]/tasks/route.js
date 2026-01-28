/**
 * Project Tasks API
 * GET: Fetch tasks for a specific project
 */

import { NextResponse } from 'next/server';
import { adminDatabases, Query, DB_ID } from '@/lib/appwriteAdmin';

const COL_TASKS = 'pms_tasks';

/**
 * GET /api/projects/[id]/tasks
 * Fetch all tasks for a project (for timesheet linking)
 */
export async function GET(request, { params }) {
  try {
    const { id: projectId } = await params;
    const { searchParams } = new URL(request.url);
    const includeCompleted = searchParams.get('includeCompleted') === 'true';

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
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
