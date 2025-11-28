/**
 * Timesheet Details API
 * GET: Fetch detailed timesheet information with entries and user data
 */

import { NextResponse } from 'next/server';
import { adminDatabases, adminUsers, Query, DB_ID } from '@/lib/appwriteAdmin';

export const dynamic = 'force-dynamic';

const COL_TIMESHEETS = 'pms_timesheets';
const COL_ENTRIES = 'pms_timesheet_entries';
const COL_USERS = 'pms_users';
const COL_PROJECTS = 'pms_projects';

/**
 * GET /api/timesheets/details
 * Fetch complete timesheet details including entries and user information
 *
 * Query params:
 * - timesheetId: Required
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const timesheetId = searchParams.get('timesheetId');

    if (!timesheetId) {
      return NextResponse.json(
        { error: 'timesheetId is required' },
        { status: 400 }
      );
    }

    // Fetch the timesheet
    const timesheet = await adminDatabases.getDocument(
      DB_ID,
      COL_TIMESHEETS,
      timesheetId
    );

    // Fetch user profile
    const userProfiles = await adminDatabases.listDocuments(
      DB_ID,
      COL_USERS,
      [
        Query.equal('accountId', timesheet.accountId),
        Query.limit(1)
      ]
    );

    const userProfile = userProfiles.documents.length > 0 ? userProfiles.documents[0] : null;

    // Fetch entries for this timesheet
    const entriesResponse = await adminDatabases.listDocuments(
      DB_ID,
      COL_ENTRIES,
      [
        Query.equal('timesheetId', timesheetId),
        Query.orderAsc('workDate'),
        Query.limit(500)
      ]
    );

    // Get unique project IDs from entries
    const projectIds = [...new Set(entriesResponse.documents.map(e => e.projectId))];

    // Fetch all projects in parallel
    const projectsData = await Promise.allSettled(
      projectIds.map(projectId =>
        adminDatabases.getDocument(DB_ID, COL_PROJECTS, projectId)
          .then(project => ({
            $id: project.$id,
            name: project.name,
            code: project.code
          }))
          .catch(() => null)
      )
    );

    // Create projects map
    const projectsMap = {};
    projectsData.forEach(result => {
      if (result.status === 'fulfilled' && result.value) {
        projectsMap[result.value.$id] = result.value;
      }
    });

    // Enrich entries with project data
    const enrichedEntries = entriesResponse.documents.map(entry => ({
      ...entry,
      project: projectsMap[entry.projectId] || null
    }));

    // Return enriched timesheet
    return NextResponse.json({
      timesheet: {
        ...timesheet,
        user: userProfile ? {
          accountId: userProfile.accountId,
          email: userProfile.email,
          username: userProfile.username,
          firstName: userProfile.firstName,
          lastName: userProfile.lastName,
          title: userProfile.title,
          department: userProfile.department
        } : null
      },
      entries: enrichedEntries,
      projects: projectsMap
    });
  } catch (error) {
    console.error('[API /timesheets/details GET]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch timesheet details' },
      { status: 500 }
    );
  }
}
