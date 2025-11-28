/**
 * Timesheet Approvals API - Optimized endpoint for approval workflows
 * GET: Fetch timesheets available for approval based on user role
 *
 * Access levels:
 * - Admins: All organization timesheets
 * - Project Managers: Timesheets from projects they manage
 * - Supervisors: Timesheets from staff they supervise
 */

import { NextResponse } from 'next/server';
import { adminDatabases, adminUsers, adminTeams, Query, DB_ID } from '@/lib/appwriteAdmin';

export const dynamic = 'force-dynamic';

const COL_TIMESHEETS = 'pms_timesheets';
const COL_ENTRIES = 'pms_timesheet_entries';
const COL_USERS = 'pms_users';
const COL_PROJECTS = 'pms_projects';

/**
 * GET /api/timesheets/approvals
 * Fetch timesheets available for approval based on user permissions
 *
 * Query params:
 * - organizationId: Required
 * - requesterId: Required (account ID of requester)
 * - status: Optional filter (submitted, approved, rejected)
 * - weekStart: Optional week filter
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const requesterId = searchParams.get('requesterId');
    const status = searchParams.get('status');
    const weekStart = searchParams.get('weekStart');

    if (!organizationId || !requesterId) {
      return NextResponse.json(
        { error: 'organizationId and requesterId are required' },
        { status: 400 }
      );
    }

    // Step 1: Determine user's access level and get permissions
    const requester = await adminUsers.get(requesterId);
    const isAdmin = requester.labels?.includes('admin');

    let accessType = 'none'; // none, admin, manager, supervisor
    let allowedAccountIds = []; // For supervisors and managers
    let managedProjectIds = []; // For managers

    if (isAdmin) {
      accessType = 'admin';
    } else {
      // Step 2a: Check if user is a supervisor
      const supervisedUsers = await adminDatabases.listDocuments(
        DB_ID,
        COL_USERS,
        [
          Query.equal('supervisedBy', requesterId),
          Query.equal('organizationId', organizationId),
          Query.limit(100) // Reasonable limit for supervised staff
        ]
      );

      if (supervisedUsers.documents.length > 0) {
        accessType = 'supervisor';
        allowedAccountIds = supervisedUsers.documents.map(u => u.accountId);
      }

      // Step 2b: Check if user is a project manager (can have both roles)
      // Fetch projects for batch checking
      const projectsForManagerCheck = await adminDatabases.listDocuments(
        DB_ID,
        COL_PROJECTS,
        [
          Query.equal('organizationId', organizationId),
          Query.limit(100) // Limited for performance
        ]
      );

      // Batch check team memberships in parallel (10 at a time)
      const batchSize = 10;
      const projectsToCheck = projectsForManagerCheck.documents;

      for (let i = 0; i < projectsToCheck.length; i += batchSize) {
        const batch = projectsToCheck.slice(i, i + batchSize);

        const membershipChecks = await Promise.allSettled(
          batch.map(project =>
            project.projectTeamId
              ? adminTeams.listMemberships(project.projectTeamId)
                  .then(teamMembers => ({
                    projectId: project.$id,
                    members: teamMembers.memberships
                  }))
                  .catch(() => null)
              : Promise.resolve(null)
          )
        );

        // Check if user is a manager in any of these projects
        for (const result of membershipChecks) {
          if (result.status === 'fulfilled' && result.value) {
            const { projectId, members } = result.value;
            const userMembership = members.find(
              m => m.userId === requesterId && m.roles.includes('manager')
            );
            if (userMembership) {
              managedProjectIds.push(projectId);
              if (accessType === 'none') {
                accessType = 'manager';
              }
            }
          }
        }
      }

      // If still no access, deny
      if (accessType === 'none') {
        return NextResponse.json(
          { error: 'Unauthorized - only admins, project managers, and supervisors can view approvals' },
          { status: 403 }
        );
      }
    }

    // Step 3: Build optimized timesheet query
    const timesheetQueries = [Query.equal('organizationId', organizationId)];

    // Apply status filter (if provided, otherwise show all)
    if (status) {
      timesheetQueries.push(Query.equal('status', status));
    }
    // Note: If no status is provided, we show all statuses (for "All" tab)

    // Apply week filter
    if (weekStart) {
      timesheetQueries.push(Query.equal('weekStart', weekStart));
    }

    // For supervisors, filter by supervised accounts
    if (accessType === 'supervisor' && allowedAccountIds.length > 0) {
      // Note: Appwrite Query.equal with array acts as OR for each value
      timesheetQueries.push(Query.equal('accountId', allowedAccountIds));
    }

    // Add ordering
    timesheetQueries.push(Query.orderDesc('weekStart'));
    timesheetQueries.push(Query.limit(100)); // Limit for performance

    // Fetch timesheets
    const timesheetsResponse = await adminDatabases.listDocuments(
      DB_ID,
      COL_TIMESHEETS,
      timesheetQueries
    );

    if (timesheetsResponse.documents.length === 0) {
      return NextResponse.json({
        timesheets: [],
        total: 0,
        accessType
      });
    }

    // Step 4: Fetch related data in parallel
    const accountIds = [...new Set(timesheetsResponse.documents.map(ts => ts.accountId))];

    const [usersResponse, allProjects] = await Promise.all([
      // Fetch all user profiles needed
      adminDatabases.listDocuments(
        DB_ID,
        COL_USERS,
        [
          Query.equal('accountId', accountIds),
          Query.limit(100)
        ]
      ),
      // Fetch projects (needed for manager filtering and display)
      adminDatabases.listDocuments(
        DB_ID,
        COL_PROJECTS,
        [
          Query.equal('organizationId', organizationId),
          Query.limit(200)
        ]
      )
    ]);

    // Create lookup maps for efficient access
    const usersMap = new Map(usersResponse.documents.map(u => [u.accountId, u]));
    const projectsMap = new Map(allProjects.documents.map(p => [p.$id, p]));

    // Step 5: Enrich timesheets with entries data in parallel (batched)
    const enrichTimesheet = async (timesheet) => {
      try {
        // Fetch entries for this timesheet
        const entriesResponse = await adminDatabases.listDocuments(
          DB_ID,
          COL_ENTRIES,
          [
            Query.equal('timesheetId', timesheet.$id),
            Query.orderAsc('workDate'),
            Query.limit(500) // Max entries per timesheet
          ]
        );

        const entries = entriesResponse.documents;

        // Calculate totals
        const totalHours = entries.reduce((sum, entry) => sum + entry.hours, 0);
        const billableHours = entries.reduce(
          (sum, entry) => (entry.billable ? sum + entry.hours : sum),
          0
        );

        // Get unique project IDs and details
        const projectIds = [...new Set(entries.map(e => e.projectId))];
        const projectsInvolved = projectIds
          .map(projectId => {
            const project = projectsMap.get(projectId);
            return project
              ? {
                  $id: project.$id,
                  name: project.name,
                  code: project.code
                }
              : null;
          })
          .filter(p => p !== null);

        // Get user profile
        const userProfile = usersMap.get(timesheet.accountId);

        return {
          ...timesheet,
          projectIds, // Keep for filtering
          user: userProfile
            ? {
                accountId: userProfile.accountId,
                email: userProfile.email,
                username: userProfile.username,
                firstName: userProfile.firstName,
                lastName: userProfile.lastName,
                title: userProfile.title,
                department: userProfile.department
              }
            : null,
          summary: {
            totalHours,
            billableHours,
            nonBillableHours: totalHours - billableHours,
            entriesCount: entries.length,
            projects: projectsInvolved
          }
        };
      } catch (error) {
        console.error(`Failed to enrich timesheet ${timesheet.$id}:`, error);
        return null;
      }
    };

    // Process timesheets in batches of 5 for better performance
    const enrichedTimesheets = [];
    const enrichBatchSize = 5;

    for (let i = 0; i < timesheetsResponse.documents.length; i += enrichBatchSize) {
      const batch = timesheetsResponse.documents.slice(i, i + enrichBatchSize);
      const enrichedBatch = await Promise.all(batch.map(enrichTimesheet));
      enrichedTimesheets.push(...enrichedBatch.filter(ts => ts !== null));
    }

    // Step 6: Filter by manager's managed projects (if applicable)
    let filteredTimesheets = enrichedTimesheets;

    if (accessType === 'manager' && managedProjectIds.length > 0) {
      filteredTimesheets = enrichedTimesheets.filter(timesheet => {
        // Only show timesheets that have entries from managed projects
        if (!timesheet.projectIds || timesheet.projectIds.length === 0) {
          return false;
        }
        // Check if any project in the timesheet is managed by this PM
        return timesheet.projectIds.some(projectId => managedProjectIds.includes(projectId));
      });
    }

    // Sort by submission date (most recent first)
    filteredTimesheets.sort((a, b) => {
      if (a.submittedAt && b.submittedAt) {
        return new Date(b.submittedAt) - new Date(a.submittedAt);
      }
      // Put timesheets without submission dates at the end
      if (a.submittedAt) return -1;
      if (b.submittedAt) return 1;
      return 0;
    });

    return NextResponse.json(
      {
        timesheets: filteredTimesheets,
        total: filteredTimesheets.length,
        accessType,
        ...(accessType === 'supervisor' && { supervisedCount: allowedAccountIds.length }),
        ...(accessType === 'manager' && { managedProjectsCount: managedProjectIds.length })
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=30, stale-while-revalidate=60'
        }
      }
    );
  } catch (error) {
    console.error('[API /timesheets/approvals GET]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch approvals' },
      { status: 500 }
    );
  }
}
