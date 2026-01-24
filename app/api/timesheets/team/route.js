/**
 * Team Timesheets API - All Staff Timesheets View
 * GET: Fetch all staff timesheets based on user role and permissions
 *
 * Access levels:
 * - Admins: All organization staff
 * - Finance: All organization staff
 * - Supervisors: Staff they supervise only
 */

import { NextResponse } from 'next/server';
import { adminDatabases, adminUsers, Query, DB_ID } from '@/lib/appwriteAdmin';

export const dynamic = 'force-dynamic';

const COL_TIMESHEETS = 'pms_timesheets';
const COL_ENTRIES = 'pms_timesheet_entries';
const COL_USERS = 'pms_users';

/**
 * GET /api/timesheets/team
 * Fetch all staff timesheets with role-based filtering
 *
 * Query params:
 * - organizationId: Required
 * - requesterId: Required (account ID of requester)
 * - viewAs: Optional - 'admin', 'finance', or 'supervisor' to override automatic role detection
 * - status: Optional filter (submitted, approved, rejected, draft, none)
 * - weekStart: Optional week filter (defaults to current week)
 * - department: Optional department filter
 * - search: Optional search query (name or username)
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const requesterId = searchParams.get('requesterId');
    const viewAsParam = searchParams.get('viewAs'); // Optional: 'admin', 'finance', 'supervisor'
    const statusFilter = searchParams.get('status');
    const weekStartFilter = searchParams.get('weekStart');
    const departmentFilter = searchParams.get('department');
    const searchQuery = searchParams.get('search');

    if (!organizationId || !requesterId) {
      return NextResponse.json(
        { error: 'organizationId and requesterId are required' },
        { status: 400 }
      );
    }

    // Step 1: Determine user's access level and available views
    const requester = await adminUsers.get(requesterId);
    const isAdmin = requester.labels?.includes('admin');
    const isFinance = requester.labels?.includes('finance');

    // Check if user is a supervisor
    const supervisedUsers = await adminDatabases.listDocuments(
      DB_ID,
      COL_USERS,
      [
        Query.equal('supervisorId', requesterId),
        Query.equal('organizationId', organizationId),
        Query.limit(200)
      ]
    );
    const isSupervisor = supervisedUsers.documents.length > 0;
    const allowedAccountIds = supervisedUsers.documents.map(u => u.accountId);

    // Determine available views for this user
    const availableViews = [];
    if (isAdmin) availableViews.push({ value: 'admin', label: 'Admin - All Staff' });
    if (isFinance) availableViews.push({ value: 'finance', label: 'Finance - All Staff' });
    if (isSupervisor) availableViews.push({
      value: 'supervisor',
      label: `Supervisor - ${allowedAccountIds.length} Supervised Staff`
    });

    // If user has no access, deny
    if (availableViews.length === 0) {
      return NextResponse.json(
        { error: 'Unauthorized - only admins, finance staff, and supervisors can view team timesheets' },
        { status: 403 }
      );
    }

    // Determine which view to use
    let accessType = viewAsParam || availableViews[0].value;

    // Validate that user has permission for the requested view
    if (!availableViews.find(v => v.value === accessType)) {
      accessType = availableViews[0].value;
    }

    // Step 2: Fetch all relevant staff based on access level
    const staffQueries = [
      Query.equal('organizationId', organizationId),
      Query.limit(500) // Reasonable limit
    ];

    // Filter by supervised staff for supervisors
    if (accessType === 'supervisor' && allowedAccountIds.length > 0) {
      staffQueries.push(Query.equal('accountId', allowedAccountIds));
    }

    // Apply department filter if provided
    if (departmentFilter) {
      staffQueries.push(Query.equal('department', departmentFilter));
    }

    // Apply search filter
    if (searchQuery) {
      // Note: Appwrite doesn't support LIKE queries, so we'll filter client-side
      // For better performance, consider using Algolia or similar for search
    }

    const staffResponse = await adminDatabases.listDocuments(
      DB_ID,
      COL_USERS,
      staffQueries
    );

    let allStaff = staffResponse.documents;

    // Client-side search filtering (since Appwrite doesn't support LIKE)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      allStaff = allStaff.filter(user => {
        const fullName = `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase();
        const username = (user.username || '').toLowerCase();
        return fullName.includes(query) || username.includes(query);
      });
    }

    // Step 3: Get current week start if not provided
    let weekStart = weekStartFilter;
    if (!weekStart) {
      const now = new Date();
      const currentWeekStart = new Date(now);
      currentWeekStart.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
      currentWeekStart.setHours(0, 0, 0, 0);
      weekStart = currentWeekStart.toISOString().split('T')[0];
    }

    // Step 4: Fetch timesheets for all staff for the selected week
    const accountIds = allStaff.map(u => u.accountId);

    let timesheetsResponse = { documents: [] };
    if (accountIds.length > 0) {
      const timesheetQueries = [
        Query.equal('organizationId', organizationId),
        Query.equal('weekStart', weekStart),
        Query.equal('accountId', accountIds),
        Query.limit(500)
      ];

      timesheetsResponse = await adminDatabases.listDocuments(
        DB_ID,
        COL_TIMESHEETS,
        timesheetQueries
      );
    }

    // Create a map of accountId -> timesheet
    const timesheetsMap = new Map(
      timesheetsResponse.documents.map(ts => [ts.accountId, ts])
    );

    // Step 5: Enrich staff data with timesheet information
    const enrichStaffMember = async (user) => {
      const timesheet = timesheetsMap.get(user.accountId);

      if (!timesheet) {
        return {
          user: {
            accountId: user.accountId,
            email: user.email,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            title: user.title,
            department: user.department
          },
          currentWeekTimesheet: null
        };
      }

      try {
        // Fetch entries for this timesheet
        const entriesResponse = await adminDatabases.listDocuments(
          DB_ID,
          COL_ENTRIES,
          [
            Query.equal('timesheetId', timesheet.$id),
            Query.limit(500)
          ]
        );

        const entries = entriesResponse.documents;
        const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);
        const billableHours = entries.reduce(
          (sum, e) => (e.billable ? sum + e.hours : sum),
          0
        );

        return {
          user: {
            accountId: user.accountId,
            email: user.email,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            title: user.title,
            department: user.department
          },
          currentWeekTimesheet: {
            timesheetId: timesheet.$id,
            status: timesheet.status || 'draft',
            totalHours,
            billableHours,
            nonBillableHours: totalHours - billableHours,
            entriesCount: entries.length,
            weekStart: timesheet.weekStart,
            submittedAt: timesheet.submittedAt || null,
            approvedAt: timesheet.approvedAt || null,
            approvedBy: timesheet.approvedBy || null
          }
        };
      } catch (error) {
        console.error(`Failed to enrich staff member ${user.accountId}:`, error);
        return {
          user: {
            accountId: user.accountId,
            email: user.email,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            title: user.title,
            department: user.department
          },
          currentWeekTimesheet: null
        };
      }
    };

    // Process in batches of 10 for performance
    const enrichedStaff = [];
    const batchSize = 10;

    for (let i = 0; i < allStaff.length; i += batchSize) {
      const batch = allStaff.slice(i, i + batchSize);
      const enrichedBatch = await Promise.all(batch.map(enrichStaffMember));
      enrichedStaff.push(...enrichedBatch);
    }

    // Step 6: Apply status filter
    let filteredStaff = enrichedStaff;
    if (statusFilter) {
      if (statusFilter === 'none') {
        filteredStaff = enrichedStaff.filter(s => !s.currentWeekTimesheet);
      } else {
        filteredStaff = enrichedStaff.filter(
          s => s.currentWeekTimesheet?.status === statusFilter
        );
      }
    }

    // Step 7: Calculate statistics
    const statistics = {
      totalStaff: filteredStaff.length,
      withTimesheets: filteredStaff.filter(s => s.currentWeekTimesheet).length,
      completionRate: 0,
      totalHours: 0,
      totalBillableHours: 0,
      statusBreakdown: {
        draft: 0,
        submitted: 0,
        approved: 0,
        rejected: 0,
        none: 0
      }
    };

    filteredStaff.forEach(staff => {
      if (staff.currentWeekTimesheet) {
        const status = staff.currentWeekTimesheet.status || 'draft';
        statistics.statusBreakdown[status] = (statistics.statusBreakdown[status] || 0) + 1;
        statistics.totalHours += staff.currentWeekTimesheet.totalHours || 0;
        statistics.totalBillableHours += staff.currentWeekTimesheet.billableHours || 0;
      } else {
        statistics.statusBreakdown.none += 1;
      }
    });

    if (statistics.totalStaff > 0) {
      statistics.completionRate = Math.round(
        (statistics.withTimesheets / statistics.totalStaff) * 100
      );
    }

    // Step 8: Sort by staff name
    filteredStaff.sort((a, b) => {
      const nameA = `${a.user.firstName || ''} ${a.user.lastName || ''}`.trim();
      const nameB = `${b.user.firstName || ''} ${b.user.lastName || ''}`.trim();
      return nameA.localeCompare(nameB);
    });

    return NextResponse.json(
      {
        staff: filteredStaff,
        statistics,
        accessType,
        availableViews,
        weekStart,
        ...(accessType === 'supervisor' && { supervisedCount: allowedAccountIds.length })
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=30, stale-while-revalidate=60'
        }
      }
    );
  } catch (error) {
    console.error('[API /timesheets/team GET]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch team timesheets' },
      { status: 500 }
    );
  }
}
