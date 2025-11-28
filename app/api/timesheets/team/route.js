/**
 * Team Timesheets API - View team members' timesheets for approval
 * GET: Fetch timesheets for team members (managers and admins only)
 */

import { NextResponse } from 'next/server';
import { adminDatabases, adminUsers, Query, DB_ID } from '@/lib/appwriteAdmin';

export const dynamic = 'force-dynamic';

const COL_TIMESHEETS = 'pms_timesheets';
const COL_ENTRIES = 'pms_timesheet_entries';
const COL_USERS = 'pms_users';
const COL_PROJECTS = 'pms_projects';

/**
 * GET /api/timesheets/team
 * Fetch team timesheets for managers/admins
 *
 * Admins can see all organization timesheets
 * Project managers can see timesheets for projects they manage
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const requesterId = searchParams.get('requesterId');
    const status = searchParams.get('status'); // Optional filter: submitted, approved, rejected
    const weekStart = searchParams.get('weekStart'); // Optional week filter

    if (!organizationId || !requesterId) {
      return NextResponse.json(
        { error: 'organizationId and requesterId are required' },
        { status: 400 }
      );
    }

    // Check if requester is admin or has manager role on any project
    const requester = await adminUsers.get(requesterId);
    const isAdmin = requester.labels?.includes('admin');

    let managedProjectIds = [];

    if (!isAdmin) {
      // Check if user is a project manager by checking team memberships
      const projects = await adminDatabases.listDocuments(DB_ID, COL_PROJECTS, [
        Query.equal('organizationId', organizationId)
      ]);

      // Check each project's team to see if requester has 'manager' role
      for (const project of projects.documents) {
        if (project.projectTeamId) {
          try {
            // Get team memberships for this project
            const memberships = await adminTeams.listMemberships(project.projectTeamId);

            // Check if requester is in this team with 'manager' role
            const membershipForUser = memberships.memberships.find(
              m => m.userId === requesterId && m.roles.includes('manager')
            );

            if (membershipForUser) {
              managedProjectIds.push(project.$id);
            }
          } catch (err) {
            console.error(`Error checking team ${project.projectTeamId}:`, err);
            // Continue checking other projects
          }
        }
      }

      // If not admin and not project manager, return error
      if (managedProjectIds.length === 0) {
        return NextResponse.json(
          { error: 'Unauthorized - only admins and project managers can view team timesheets' },
          { status: 403 }
        );
      }
    }

    // Build query for timesheets
    const queries = [];

    // If a specific status is requested
    if (status) {
      queries.push(Query.equal('status', status));
    } else {
      // By default, show submitted timesheets (pending approval)
      queries.push(Query.equal('status', 'submitted'));
    }

    // If a specific week is requested
    if (weekStart) {
      queries.push(Query.equal('weekStart', weekStart));
    }

    // Fetch timesheets
    const timesheetsResponse = await adminDatabases.listDocuments(
      DB_ID,
      COL_TIMESHEETS,
      queries
    );

    // Enrich timesheets with user details and entries summary
    const enrichedTimesheets = await Promise.all(
      timesheetsResponse.documents.map(async (timesheet) => {
        try {
          // Get user profile
          const userProfiles = await adminDatabases.listDocuments(
            DB_ID,
            COL_USERS,
            [
              Query.equal('accountId', timesheet.accountId),
              Query.limit(1)
            ]
          );

          const userProfile = userProfiles.documents.length > 0 ? userProfiles.documents[0] : null;

          // Get entries for this timesheet
          const entriesResponse = await adminDatabases.listDocuments(
            DB_ID,
            COL_ENTRIES,
            [
              Query.equal('timesheetId', timesheet.$id),
              Query.orderAsc('workDate')
            ]
          );

          // Calculate totals
          const totalHours = entriesResponse.documents.reduce((sum, entry) => sum + entry.hours, 0);
          const billableHours = entriesResponse.documents.reduce(
            (sum, entry) => entry.billable ? sum + entry.hours : sum,
            0
          );

          // Get unique projects
          const projectIds = [...new Set(entriesResponse.documents.map(e => e.projectId))];
          const projectsInvolved = await Promise.all(
            projectIds.map(async (projectId) => {
              try {
                const project = await adminDatabases.getDocument(DB_ID, COL_PROJECTS, projectId);
                return {
                  $id: project.$id,
                  name: project.name,
                  code: project.code
                };
              } catch (err) {
                return null;
              }
            })
          );

          return {
            ...timesheet,
            projectIds, // Keep projectIds for filtering
            user: userProfile ? {
              accountId: userProfile.accountId,
              email: userProfile.email,
              username: userProfile.username,
              firstName: userProfile.firstName,
              lastName: userProfile.lastName,
              title: userProfile.title
            } : null,
            summary: {
              totalHours,
              billableHours,
              nonBillableHours: totalHours - billableHours,
              entriesCount: entriesResponse.documents.length,
              projects: projectsInvolved.filter(p => p !== null)
            }
          };
        } catch (error) {
          console.error(`Failed to enrich timesheet ${timesheet.$id}:`, error);
          return timesheet;
        }
      })
    );

    // Filter by project manager's managed projects (if not admin)
    let filteredTimesheets = enrichedTimesheets;
    if (!isAdmin && managedProjectIds.length > 0) {
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
      return 0;
    });

    return NextResponse.json({
      timesheets: filteredTimesheets,
      total: filteredTimesheets.length
    });
  } catch (error) {
    console.error('[API /timesheets/team GET]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch team timesheets' },
      { status: 500 }
    );
  }
}
