/**
 * Project Timesheets API
 * GET: Fetch all timesheet entries for a specific project
 */

import { NextResponse } from 'next/server';
import { adminDatabases, adminUsers, adminTeams, Query, DB_ID } from '@/lib/appwriteAdmin';

const COL_ENTRIES = 'pms_timesheet_entries';
const COL_TIMESHEETS = 'pms_timesheets';
const COL_USERS = 'pms_users';
const COL_PROJECTS = 'pms_projects';
const COL_TASKS = 'pms_tasks';

/**
 * GET /api/projects/[id]/timesheets
 * Fetch all time entries for a project with filters
 *
 * Query params:
 * - requesterId: User making the request
 * - startDate: Filter entries from this date (optional)
 * - endDate: Filter entries to this date (optional)
 * - status: Filter by timesheet status (optional)
 * - userId: Filter by specific user (optional)
 */
export async function GET(request, { params }) {
  try {
    const { id: projectId } = params;
    const { searchParams } = new URL(request.url);
    const requesterId = searchParams.get('requesterId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const status = searchParams.get('status');
    const userId = searchParams.get('userId');

    if (!projectId || !requesterId) {
      return NextResponse.json(
        { error: 'projectId and requesterId are required' },
        { status: 400 }
      );
    }

    // Get the project
    const project = await adminDatabases.getDocument(DB_ID, COL_PROJECTS, projectId);

    // Check authorization - must be admin or project manager
    const requester = await adminUsers.get(requesterId);
    const isAdmin = requester.labels?.includes('admin');

    let isProjectManager = false;
    if (!isAdmin && project.projectTeamId) {
      try {
        const memberships = await adminTeams.listMemberships(project.projectTeamId);
        const membership = memberships.memberships.find(
          m => m.userId === requesterId && m.roles.includes('manager')
        );
        isProjectManager = !!membership;
      } catch (err) {
        console.error('Error checking team membership:', err);
      }
    }

    if (!isAdmin && !isProjectManager) {
      return NextResponse.json(
        { error: 'Unauthorized - only admins and project managers can view project time' },
        { status: 403 }
      );
    }

    // Build queries for entries
    const entryQueries = [Query.equal('projectId', projectId)];

    // Add date filters if provided
    if (startDate) {
      entryQueries.push(Query.greaterThanEqual('workDate', startDate));
    }
    if (endDate) {
      entryQueries.push(Query.lessThanEqual('workDate', endDate));
    }

    entryQueries.push(Query.orderDesc('workDate'));
    entryQueries.push(Query.limit(1000)); // Limit to prevent excessive data

    // Fetch all entries for this project
    const entriesResponse = await adminDatabases.listDocuments(
      DB_ID,
      COL_ENTRIES,
      entryQueries
    );

    // Get unique timesheet IDs
    const timesheetIds = [...new Set(entriesResponse.documents.map(e => e.timesheetId))];

    // Fetch timesheets and filter by status if needed
    const timesheetsMap = {};
    for (const timesheetId of timesheetIds) {
      try {
        const timesheet = await adminDatabases.getDocument(DB_ID, COL_TIMESHEETS, timesheetId);

        // Apply status filter
        if (status && timesheet.status !== status) {
          continue;
        }

        // Apply user filter
        if (userId && timesheet.accountId !== userId) {
          continue;
        }

        timesheetsMap[timesheetId] = timesheet;
      } catch (err) {
        console.error(`Failed to fetch timesheet ${timesheetId}:`, err);
      }
    }

    // Filter entries to only include those from valid timesheets
    const filteredEntries = entriesResponse.documents.filter(
      entry => timesheetsMap[entry.timesheetId]
    );

    // Get unique user account IDs
    const accountIds = [...new Set(Object.values(timesheetsMap).map(t => t.accountId))];

    // Fetch user profiles
    const usersMap = {};
    for (const accountId of accountIds) {
      try {
        const userProfiles = await adminDatabases.listDocuments(
          DB_ID,
          COL_USERS,
          [Query.equal('accountId', accountId), Query.limit(1)]
        );

        if (userProfiles.documents.length > 0) {
          usersMap[accountId] = userProfiles.documents[0];
        }
      } catch (err) {
        console.error(`Failed to fetch user ${accountId}:`, err);
      }
    }

    // Get unique task IDs
    const taskIds = [...new Set(filteredEntries.map(e => e.taskId).filter(Boolean))];

    // Fetch tasks
    const tasksMap = {};
    for (const taskId of taskIds) {
      try {
        const task = await adminDatabases.getDocument(DB_ID, COL_TASKS, taskId);
        tasksMap[taskId] = task;
      } catch (err) {
        console.error(`Failed to fetch task ${taskId}:`, err);
      }
    }

    // Enrich entries with user and timesheet info
    const enrichedEntries = filteredEntries.map(entry => {
      const timesheet = timesheetsMap[entry.timesheetId];
      const user = usersMap[timesheet?.accountId];
      const task = entry.taskId ? tasksMap[entry.taskId] : null;

      return {
        ...entry,
        timesheet: {
          $id: timesheet.$id,
          status: timesheet.status,
          weekStart: timesheet.weekStart,
          submittedAt: timesheet.submittedAt,
          approvedAt: timesheet.approvedAt,
          approvedBy: timesheet.approvedBy
        },
        user: user ? {
          accountId: user.accountId,
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          title: user.title
        } : null,
        task: task ? {
          $id: task.$id,
          title: task.title,
          status: task.status
        } : null
      };
    });

    // Calculate summary statistics
    const totalHours = enrichedEntries.reduce((sum, e) => sum + e.hours, 0);
    const billableHours = enrichedEntries.reduce(
      (sum, e) => e.billable ? sum + e.hours : sum,
      0
    );
    const uniqueUsers = [...new Set(enrichedEntries.map(e => e.user?.accountId).filter(Boolean))].length;

    // Group by user for summary
    const userSummaries = {};
    enrichedEntries.forEach(entry => {
      const accountId = entry.user?.accountId;
      if (!accountId) return;

      if (!userSummaries[accountId]) {
        userSummaries[accountId] = {
          user: entry.user,
          totalHours: 0,
          billableHours: 0,
          entriesCount: 0
        };
      }

      userSummaries[accountId].totalHours += entry.hours;
      if (entry.billable) {
        userSummaries[accountId].billableHours += entry.hours;
      }
      userSummaries[accountId].entriesCount++;
    });

    return NextResponse.json({
      project: {
        $id: project.$id,
        name: project.name,
        code: project.code,
        status: project.status
      },
      entries: enrichedEntries,
      summary: {
        totalHours,
        billableHours,
        nonBillableHours: totalHours - billableHours,
        entriesCount: enrichedEntries.length,
        uniqueUsers,
        userSummaries: Object.values(userSummaries)
      }
    });
  } catch (error) {
    console.error('[API /projects/[id]/timesheets GET]', error);

    if (error.code === 404) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json(
      { error: error.message || 'Failed to fetch project timesheets' },
      { status: 500 }
    );
  }
}
