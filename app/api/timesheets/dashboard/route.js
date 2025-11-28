/**
 * Timesheets Dashboard API
 * GET: Fetch dashboard statistics and recent timesheets
 */

import { NextResponse } from 'next/server';
import { adminDatabases, Query, DB_ID } from '@/lib/appwriteAdmin';

export const dynamic = 'force-dynamic';

const COL_TIMESHEETS = 'pms_timesheets';
const COL_ENTRIES = 'pms_timesheet_entries';
const COL_USERS = 'pms_users';

/**
 * GET /api/timesheets/dashboard
 * Fetch dashboard data for the authenticated user
 *
 * Query params:
 * - accountId: Required
 * - organizationId: Required
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    const organizationId = searchParams.get('organizationId');

    if (!accountId || !organizationId) {
      return NextResponse.json(
        { error: 'accountId and organizationId are required' },
        { status: 400 }
      );
    }

    // Fetch all user's timesheets (with reasonable limit)
    const timesheetsResponse = await adminDatabases.listDocuments(
      DB_ID,
      COL_TIMESHEETS,
      [
        Query.equal('accountId', accountId),
        Query.equal('organizationId', organizationId),
        Query.orderDesc('weekStart'),
        Query.limit(50) // Get last 50 timesheets for stats
      ]
    );

    const allTimesheets = timesheetsResponse.documents;

    // Calculate status counts
    const statusCounts = {
      draft: 0,
      submitted: 0,
      approved: 0,
      rejected: 0,
      total: allTimesheets.length
    };

    allTimesheets.forEach(ts => {
      const status = ts.status || 'draft';
      if (statusCounts.hasOwnProperty(status)) {
        statusCounts[status]++;
      }
    });

    // Get recent timesheets (last 10)
    const recentTimesheets = allTimesheets.slice(0, 10);

    // Enrich recent timesheets with entry counts and hours
    const enrichedRecent = await Promise.all(
      recentTimesheets.map(async (timesheet) => {
        try {
          const entriesResponse = await adminDatabases.listDocuments(
            DB_ID,
            COL_ENTRIES,
            [
              Query.equal('timesheetId', timesheet.$id),
              Query.limit(500)
            ]
          );

          const entries = entriesResponse.documents;
          const totalHours = entries.reduce((sum, entry) => sum + entry.hours, 0);
          const billableHours = entries.reduce(
            (sum, entry) => (entry.billable ? sum + entry.hours : sum),
            0
          );

          return {
            ...timesheet,
            entriesCount: entries.length,
            totalHours,
            billableHours,
            nonBillableHours: totalHours - billableHours
          };
        } catch (error) {
          console.error(`Failed to enrich timesheet ${timesheet.$id}:`, error);
          return {
            ...timesheet,
            entriesCount: 0,
            totalHours: 0,
            billableHours: 0,
            nonBillableHours: 0
          };
        }
      })
    );

    // Calculate current week stats
    const now = new Date();
    const currentWeekStart = new Date(now);
    currentWeekStart.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
    currentWeekStart.setHours(0, 0, 0, 0);

    const currentWeekStartISO = currentWeekStart.toISOString().split('T')[0];

    const currentWeekTimesheet = allTimesheets.find(
      ts => ts.weekStart === currentWeekStartISO
    );

    let currentWeekStats = {
      exists: false,
      status: 'draft',
      totalHours: 0,
      entriesCount: 0
    };

    if (currentWeekTimesheet) {
      try {
        const entriesResponse = await adminDatabases.listDocuments(
          DB_ID,
          COL_ENTRIES,
          [
            Query.equal('timesheetId', currentWeekTimesheet.$id),
            Query.limit(500)
          ]
        );

        const totalHours = entriesResponse.documents.reduce(
          (sum, entry) => sum + entry.hours,
          0
        );

        currentWeekStats = {
          exists: true,
          status: currentWeekTimesheet.status || 'draft',
          totalHours,
          entriesCount: entriesResponse.documents.length,
          timesheetId: currentWeekTimesheet.$id,
          weekStart: currentWeekTimesheet.weekStart
        };
      } catch (error) {
        console.error('Failed to get current week stats:', error);
      }
    }

    return NextResponse.json(
      {
        statusCounts,
        recentTimesheets: enrichedRecent,
        currentWeekStats
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=30'
        }
      }
    );
  } catch (error) {
    console.error('[API /timesheets/dashboard GET]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}
