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

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

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
    timesheetQueries.push(Query.orderDesc('submittedAt')); // Sort by submission (usually better for approvals) or weekStart
    // The original code used weekStart, then sorted by submittedAt in memory. I will stick to submittedAt for DB sort.
    // Wait, original was `Query.orderDesc('weekStart')`.
    // I will change to `Query.orderDesc('submittedAt')` as recently submitted items are more relevant for approval.
    // However, consistency matters. Let's stick to 'weekStart' to match previous logic unless user complained. 
    // Actually, line 354 sorts by `submittedAt`. So DB should too.
    // But does `submittedAt` exist on all? No, Drafts don't have it.
    // But approvals page usually filters by `submitted`.
    // Let's use `weekStart` as primary DB sort to be safe, or `updatedAt`.
    // I'll stick to `weekStart`.
    timesheetQueries.push(Query.orderDesc('weekStart'));

    // Pagination
    timesheetQueries.push(Query.limit(limit));
    timesheetQueries.push(Query.offset(offset));

    // Fetch timesheets
    const timesheetsResponse = await adminDatabases.listDocuments(
      DB_ID,
      COL_TIMESHEETS,
      timesheetQueries
    );

    if (timesheetsResponse.documents.length === 0) {
      return NextResponse.json({
        timesheets: [],
        total: timesheetsResponse.total, // Use DB total
        accessType,
        page,
        limit,
        totalPages: Math.ceil(timesheetsResponse.total / limit)
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

    // Step 6: Filter and Enrich with Approval Stage
    let filteredTimesheets = enrichedTimesheets;

    // Helper to determine stage
    const getApprovalStage = (ts, userProfile) => {
      if (ts.status === 'rejected') return 'rejected';
      if (ts.status === 'approved') return 'completed';

      // Status is submitted or draft (but approvals page usually sees submitted)
      if (ts.status === 'submitted') {
        // If supervisorApproval is explicitly false, it is pending supervisor
        // (assuming supervisorId existed at submission, which sets it to false)
        // If supervisorApproval is null, it means no supervisor req (Pending Admin)
        // If supervisorApproval is true, it is Supervisor Approved (Pending Admin)
        if (ts.supervisorApproval === false) return 'supervisor';
        return 'admin';
      }
      return 'unknown';
    };

    // Filter for Managers (Project Managers)
    if (accessType === 'manager' && managedProjectIds.length > 0) {
      filteredTimesheets = filteredTimesheets.filter(timesheet => {
        if (!timesheet.projectIds || timesheet.projectIds.length === 0) return false;
        return timesheet.projectIds.some(projectId => managedProjectIds.includes(projectId));
      });
    }

    // Filter/Process for Supervisors and Admins
    if (accessType === 'supervisor' && !isAdmin) {
      // Supervisors should only see items pending SUPERVISOR approval
      // They shouldn't see items waiting for Admin (unless they double hat, handled by isAdmin check)
      // They definitely shouldn't see items they already approved (unless history?)
      // The 'status' query param filters broad buckets.

      if (status === 'submitted') {
        filteredTimesheets = filteredTimesheets.filter(ts => {
          const stage = getApprovalStage(ts);
          return stage === 'supervisor';
        });
      }
    }

    // Add computed fields for UI
    filteredTimesheets = filteredTimesheets.map(ts => {
      const stage = getApprovalStage(ts);

      let canApprove = false;
      if (ts.status === 'submitted') {
        if (stage === 'supervisor') {
          // Actionable by Supervisor
          // Check if current user is the supervisor
          // (User profile for 'supervisedBy' check is one way, but we have supervisorId on submitting user)
          // We fetched users in Step 4.
          const submitter = usersMap.get(ts.accountId);
          // The submitter's supervisorId must match requesterId
          if (submitter?.supervisorId === requesterId) canApprove = true;

          // Admins can approve if they are ALSO the supervisor? 
          // We handle that logic in UI, but here we flag visibility.
          if (isAdmin && submitter?.supervisorId === requesterId) canApprove = true;

        } else if (stage === 'admin') {
          // Actionable by Admin
          if (isAdmin) canApprove = true;
        }
      }

      return {
        ...ts,
        approvalStage: stage,
        canApprove,
        // Pass the submitter's supervisorId for UI reference if needed
        submitterSupervisorId: usersMap.get(ts.accountId)?.supervisorId
      };
    });

    // Sort by submission date (most recent first)
    filteredTimesheets.sort((a, b) => {
      if (a.submittedAt && b.submittedAt) {
        return new Date(b.submittedAt) - new Date(a.submittedAt);
      }
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
