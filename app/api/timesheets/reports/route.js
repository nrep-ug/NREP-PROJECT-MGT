/**
 * Timesheet Reports & Analytics API
 * GET: Generate various reports and analytics with RBAC
 *
 * Data Structure:
 * - Timesheets (pms_timesheets): Weekly timesheet records with status (draft, submitted, approved, rejected)
 * - Entries (pms_timesheet_entries): Individual time entries linked to a parent timesheet
 *
 * Important: Reports only include entries from timesheets with status 'submitted' or 'approved'.
 *            Draft and rejected timesheets are excluded from analytics.
 *
 * Role-based access (per RBAC_ARCHITECTURE.md):
 * - Admin (label: 'admin'): Can see all timesheets from all projects and all staff
 * - Manager (project team role: 'manager'): Can see timesheets from projects they manage + their own
 * - Staff (label: 'staff'): Can only see their own timesheets
 *
 * Note: Manager role is determined by checking project team memberships, not labels.
 *       A staff member with 'manager' role in any project team is considered a manager.
 *
 * Performance Optimizations:
 * - Parallel batch processing for team membership checks (batches of 10)
 * - Maximum limits on data fetching (1000 timesheets, 5000 entries)
 * - Response caching (60s with 5min stale-while-revalidate)
 * - Reduced query limits for projects (200) and accounts (200)
 * - Active-only account filtering
 *
 * Recommended Database Indexes (for Appwrite admin):
 * - pms_timesheets: organizationId, status, weekStart, accountId
 * - pms_timesheet_entries: timesheetId, workDate, projectId
 * - pms_projects: organizationId
 * - pms_users: organizationId, status, accountId
 *
 * Query params:
 *   - accountId (required) - User requesting the report
 *   - organizationId (required)
 *   - labels (required) - JSON stringified array of user labels from session (e.g., ['admin', 'staff'])
 *   - type: 'summary' | 'by-project' | 'by-user' | 'trends'
 *   - startDate: YYYY-MM-DD (optional)
 *   - endDate: YYYY-MM-DD (optional)
 *   - projectId: filter by project (optional)
 *   - userId: filter by user (optional)
 *   - export: 'csv' to export as CSV (optional)
 */

import { NextResponse } from 'next/server';
import { adminDatabases, Query, DB_ID, adminTeams } from '@/lib/appwriteAdmin';
import moment from 'moment-timezone';

export const dynamic = 'force-dynamic';

const COL_ENTRIES = 'pms_timesheet_entries';
const COL_TIMESHEETS = 'pms_timesheets';
const COL_PROJECTS = 'pms_projects';
const COL_ACCOUNTS = 'pms_users';

/**
 * GET /api/timesheets/reports
 * Generate reports and analytics with RBAC
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    const organizationId = searchParams.get('organizationId');
    const labelsParam = searchParams.get('labels');
    const type = searchParams.get('type') || 'summary';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const projectId = searchParams.get('projectId');
    const userId = searchParams.get('userId');
    const frequency = searchParams.get('frequency') || 'weekly';
    const exportFormat = searchParams.get('export');

    if (!accountId || !organizationId || !labelsParam) {
      return NextResponse.json(
        { error: 'accountId, organizationId, and labels are required' },
        { status: 400 }
      );
    }

    // Parse labels array from JSON string
    let userLabels = [];
    try {
      userLabels = JSON.parse(labelsParam);
      if (!Array.isArray(userLabels)) {
        userLabels = [labelsParam]; // Fallback if it's not an array
      }
    } catch (err) {
      userLabels = [labelsParam]; // Fallback if parsing fails
    }

    // Check role labels
    const isAdmin = userLabels.includes('admin');
    const isFinance = userLabels.includes('finance');
    const isSupervisor = userLabels.includes('supervisor');

    // Check if user is a manager of any project (query project teams)
    // Note: 'manager' is a project team role, NOT a label
    // Even admins can be managers of specific projects, so we check for everyone
    let managedProjectIds = [];
    let isManager = false;

    // For supervisors (who are not admin/finance), fetch supervised users
    let supervisedAccountIds = [];
    if (isSupervisor && !isAdmin && !isFinance) {
      try {
        const supervisedUsers = await adminDatabases.listDocuments(DB_ID, COL_ACCOUNTS, [
          Query.equal('supervisorId', accountId),
          Query.equal('organizationId', organizationId),
          Query.equal('status', 'active'),
          Query.equal('userType', 'staff'), // Exclude clients
          Query.limit(200)
        ]);
        supervisedAccountIds = supervisedUsers.documents.map(u => u.accountId);
      } catch (err) {
        console.error('[Timesheet Reports] Error fetching supervised users:', err);
      }
    }

    // Optimized: Fetch projects in parallel batches and check memberships more efficiently
    const projectsForManagerCheck = await adminDatabases.listDocuments(DB_ID, COL_PROJECTS, [
      Query.equal('organizationId', organizationId),
      Query.limit(100) // Limit to first 100 projects for performance
    ]);

    // Batch check team memberships - process in parallel batches of 10
    const batchSize = 10;
    const projectsToCheck = projectsForManagerCheck.documents;

    for (let i = 0; i < projectsToCheck.length; i += batchSize) {
      const batch = projectsToCheck.slice(i, i + batchSize);

      // Process batch in parallel
      const membershipChecks = await Promise.allSettled(
        batch.map(project =>
          adminTeams.listMemberships(project.projectTeamId)
            .then(teamMembers => ({
              projectId: project.$id,
              members: teamMembers.memberships
            }))
            .catch(() => null)
        )
      );

      // Check if user is a manager in any of these projects
      for (const result of membershipChecks) {
        if (result.status === 'fulfilled' && result.value) {
          const { projectId, members } = result.value;
          const userMembership = members.find(
            m => m.userId === accountId && m.roles.includes('manager')
          );
          if (userMembership) {
            managedProjectIds.push(projectId);
            isManager = true;
          }
        }
      }
    }

    // Step 1: Build timesheet filters based on role
    const timesheetFilters = [
      Query.equal('organizationId', organizationId),
      // Only include submitted and approved timesheets in reports
      Query.equal('status', ['submitted', 'approved'])
    ];

    // Date range filter on weekStart
    if (startDate) {
      timesheetFilters.push(Query.greaterThanEqual('weekStart', startDate));
    }
    if (endDate) {
      timesheetFilters.push(Query.lessThanEqual('weekStart', endDate));
    }

    // Role-based filtering for timesheets
    // Priority: Admin/Finance > Supervisor > Manager > Staff
    if (isAdmin || isFinance) {
      // Admin/Finance: Can see all organization timesheets
      // Apply user filter if specified
      if (userId) {
        timesheetFilters.push(Query.equal('accountId', userId));
      }
    } else if (isSupervisor) {
      // Supervisor: Can only see supervised users' timesheets
      if (userId) {
        // Validate userId is in supervised list
        if (!supervisedAccountIds.includes(userId)) {
          // Not authorized to view this user, return empty data
          return NextResponse.json({
            success: true,
            type,
            role: 'supervisor',
            isAdmin: false,
            isFinance: false,
            isSupervisor: true,
            isManager: false,
            supervisedUsersCount: supervisedAccountIds.length,
            error: 'Not authorized to view this user',
            filters: { startDate: startDate || 'all', endDate: endDate || 'all', projectId: projectId || 'all', userId },
            data: type === 'summary' ? { summary: getEmptySummary(), topProjects: [], topUsers: [] } : []
          });
        }
        timesheetFilters.push(Query.equal('accountId', userId));
      } else {
        // Show all supervised users
        if (supervisedAccountIds.length > 0) {
          timesheetFilters.push(Query.equal('accountId', supervisedAccountIds));
        } else {
          // No supervised users, return empty data
          return NextResponse.json({
            success: true,
            type,
            role: 'supervisor',
            isAdmin: false,
            isFinance: false,
            isSupervisor: true,
            isManager: false,
            supervisedUsersCount: 0,
            filters: { startDate: startDate || 'all', endDate: endDate || 'all', projectId: projectId || 'all', userId: userId || 'all' },
            data: type === 'summary' ? { summary: getEmptySummary(), topProjects: [], topUsers: [] } : []
          });
        }
      }
    } else if (isManager) {
      // Manager: Can see timesheets from managed projects' team members + own timesheets
      // We'll filter entries later by project
      if (userId) {
        timesheetFilters.push(Query.equal('accountId', userId));
      }
    } else {
      // Staff: Only own timesheets
      timesheetFilters.push(Query.equal('accountId', accountId));
    }

    // Step 2: Fetch timesheets with maximum limit for performance
    let allTimesheets = [];
    let offset = 0;
    const limit = 100;
    const maxTimesheets = 1000; // Prevent excessive data fetching
    let hasMore = true;

    while (hasMore && allTimesheets.length < maxTimesheets) {
      // Build complete query array for this iteration
      const queries = timesheetFilters.concat([
        Query.limit(limit),
        Query.offset(offset),
        Query.orderDesc('weekStart')
      ]);

      const response = await adminDatabases.listDocuments(DB_ID, COL_TIMESHEETS, queries);

      allTimesheets = allTimesheets.concat(response.documents);
      offset += limit;
      hasMore = response.documents.length === limit && allTimesheets.length < maxTimesheets;
    }

    // Step 3: If no timesheets found, return empty data
    if (allTimesheets.length === 0) {
      // Determine primary role for empty response
      let emptyRole = 'staff';
      if (isAdmin) emptyRole = 'admin';
      else if (isFinance) emptyRole = 'finance';
      else if (isSupervisor) emptyRole = 'supervisor';
      else if (isManager) emptyRole = 'manager';

      return NextResponse.json({
        success: true,
        type,
        role: emptyRole,
        isAdmin,
        isFinance,
        isSupervisor,
        isManager,
        supervisedUsersCount: supervisedAccountIds.length,
        managedProjectsCount: managedProjectIds.length,
        managedProjects: managedProjectIds,
        filters: {
          startDate: startDate || 'all',
          endDate: endDate || 'all',
          projectId: projectId || 'all',
          userId: userId || 'all'
        },
        data: type === 'summary' ? { summary: getEmptySummary(), topProjects: [], topUsers: [] } : []
      });
    }

    // Step 4: Get timesheet IDs and create accountId mapping
    const timesheetIds = allTimesheets.map(ts => ts.$id);
    const timesheetAccountMap = {}; // Map timesheetId -> accountId
    allTimesheets.forEach(ts => {
      timesheetAccountMap[ts.$id] = ts.accountId;
    });

    // Step 5: Fetch entries for these timesheets
    // Note: No need to filter by organizationId since timesheets are already filtered by org
    const entryFilters = [
      Query.equal('timesheetId', timesheetIds)
    ];

    // Apply date filter on workDate
    if (startDate) {
      entryFilters.push(Query.greaterThanEqual('workDate', startDate));
    }
    if (endDate) {
      entryFilters.push(Query.lessThanEqual('workDate', endDate));
    }

    // Apply project filter if specified
    if (projectId) {
      entryFilters.push(Query.equal('projectId', projectId));
    }

    let allEntries = [];
    offset = 0;
    const maxEntries = 5000; // Limit total entries for performance
    hasMore = true;

    while (hasMore && allEntries.length < maxEntries) {
      // Build complete query array for this iteration
      const queries = entryFilters.concat([
        Query.limit(limit),
        Query.offset(offset),
        Query.orderDesc('workDate')
      ]);

      const response = await adminDatabases.listDocuments(DB_ID, COL_ENTRIES, queries);

      allEntries = allEntries.concat(response.documents);
      offset += limit;
      hasMore = response.documents.length === limit && allEntries.length < maxEntries;
    }

    // Step 6: Add accountId to entries from parent timesheet
    allEntries = allEntries.map(entry => ({
      ...entry,
      accountId: timesheetAccountMap[entry.timesheetId]
    }));

    // Step 7: Additional filtering for managers (only entries from managed projects + own entries)
    // Only apply if not admin/finance
    if (isManager && !isAdmin && !isFinance && !userId && !projectId) {
      allEntries = allEntries.filter(entry => {
        return entry.accountId === accountId || managedProjectIds.includes(entry.projectId);
      });
    }

    // Step 8: If manager viewing specific project, ensure they manage it
    if (isManager && !isAdmin && !isFinance && projectId && !managedProjectIds.includes(projectId)) {
      // Not a managed project, can only see own entries
      allEntries = allEntries.filter(entry => entry.accountId === accountId);
    }

    // Step 9: Fetch related data (projects and accounts) - optimized with limits
    const [projectsResponse, accountsResponse] = await Promise.all([
      adminDatabases.listDocuments(DB_ID, COL_PROJECTS, [
        Query.equal('organizationId', organizationId),
        Query.limit(200) // Reduced from 500 for faster queries
      ]),
      adminDatabases.listDocuments(DB_ID, COL_ACCOUNTS, [
        Query.equal('organizationId', organizationId),
        Query.equal('status', 'active'), // Only fetch active accounts
        Query.equal('userType', 'staff'), // Exclude clients
        Query.limit(200) // Reduced from 500 for faster queries
      ])
    ]);

    const projects = projectsResponse.documents;
    const accounts = accountsResponse.documents;

    // Helper functions
    const getProjectName = (projId) => {
      const proj = projects.find(p => p.$id === projId);
      return proj ? `${proj.code} - ${proj.name}` : projId;
    };

    const getUserName = (accId) => {
      // Note: accId is the Appwrite auth user ID, stored in accountId field, not document $id
      const acc = accounts.find(a => a.accountId === accId);
      return acc ? `${acc.firstName} ${acc.lastName}` : accId;
    };

    // Generate report based on type
    let reportData;

    switch (type) {
      case 'summary':
        reportData = generateSummaryReport(allEntries, projects, accounts);
        break;

      case 'by-project':
        reportData = generateByProjectReport(allEntries, projects, getProjectName);
        break;

      case 'by-user':
        reportData = generateByUserReport(allEntries, accounts, getUserName);
        break;

      case 'trends':
        reportData = generateTrendsReport(allEntries, frequency, startDate, endDate);
        break;

      default:
        return NextResponse.json(
          { error: `Unknown report type: ${type}` },
          { status: 400 }
        );
    }

    // Handle CSV export
    if (exportFormat === 'csv') {
      const csv = generateCSV(reportData, type);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="timesheet-report-${type}-${Date.now()}.csv"`
        }
      });
    }

    // Return primary role for display
    // Priority: Admin > Finance > Supervisor > Manager > Staff
    let primaryRole = 'staff';
    if (isAdmin) {
      primaryRole = 'admin';
    } else if (isFinance) {
      primaryRole = 'finance';
    } else if (isSupervisor) {
      primaryRole = 'supervisor';
    } else if (isManager) {
      primaryRole = 'manager';
    }

    return NextResponse.json({
      success: true,
      type,
      role: primaryRole,
      isAdmin,
      isFinance,
      isSupervisor,
      isManager,
      supervisedUsersCount: supervisedAccountIds.length,
      managedProjectsCount: managedProjectIds.length,
      managedProjects: managedProjectIds, // Array of project IDs user manages
      filters: {
        startDate: startDate || 'all',
        endDate: endDate || 'all',
        projectId: projectId || 'all',
        userId: userId || 'all'
      },
      data: reportData
    }, {
      headers: {
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=300'
      }
    });
  } catch (error) {
    console.error('[API /timesheets/reports GET]', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to generate report',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * Get empty summary for cases with no data
 */
function getEmptySummary() {
  return {
    totalHours: '0.0',
    billableHours: '0.0',
    nonBillableHours: '0.0',
    billablePercentage: 0,
    totalEntries: 0,
    uniqueUsers: 0,
    uniqueProjects: 0,
    avgHoursPerUser: 0,
    thisWeekHours: '0.0',
    thisMonthHours: '0.0'
  };
}

/**
 * Generate summary report
 */
function generateSummaryReport(entries, projects, accounts) {
  const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);
  const billableHours = entries.filter(e => e.billable).reduce((sum, e) => sum + e.hours, 0);
  const nonBillableHours = totalHours - billableHours;
  const billablePercentage = totalHours > 0 ? (billableHours / totalHours * 100).toFixed(1) : 0;

  // Unique users and projects
  const uniqueUsers = [...new Set(entries.map(e => e.accountId))];
  const uniqueProjects = [...new Set(entries.map(e => e.projectId))];

  // Average hours per user
  const avgHoursPerUser = uniqueUsers.length > 0 ? (totalHours / uniqueUsers.length).toFixed(1) : 0;

  // This week's hours
  const thisWeekStart = moment().startOf('week');
  const thisWeekEnd = moment().endOf('week');
  const thisWeekHours = entries
    .filter(e => {
      const date = moment(e.workDate);
      return date.isBetween(thisWeekStart, thisWeekEnd, null, '[]');
    })
    .reduce((sum, e) => sum + e.hours, 0);

  // This month's hours
  const thisMonthStart = moment().startOf('month');
  const thisMonthEnd = moment().endOf('month');
  const thisMonthHours = entries
    .filter(e => {
      const date = moment(e.workDate);
      return date.isBetween(thisMonthStart, thisMonthEnd, null, '[]');
    })
    .reduce((sum, e) => sum + e.hours, 0);

  return {
    summary: {
      totalHours: totalHours.toFixed(1),
      billableHours: billableHours.toFixed(1),
      nonBillableHours: nonBillableHours.toFixed(1),
      billablePercentage: parseFloat(billablePercentage),
      totalEntries: entries.length,
      uniqueUsers: uniqueUsers.length,
      uniqueProjects: uniqueProjects.length,
      avgHoursPerUser: parseFloat(avgHoursPerUser),
      thisWeekHours: thisWeekHours.toFixed(1),
      thisMonthHours: thisMonthHours.toFixed(1)
    },
    topProjects: getTopProjects(entries, projects, 5),
    topUsers: getTopUsers(entries, accounts, 5)
  };
}

/**
 * Generate by-project report
 */
function generateByProjectReport(entries, projects, getProjectName) {
  const projectMap = {};

  entries.forEach(entry => {
    const projId = entry.projectId;
    if (!projectMap[projId]) {
      projectMap[projId] = {
        projectId: projId,
        projectName: getProjectName(projId),
        totalHours: 0,
        billableHours: 0,
        nonBillableHours: 0,
        entries: 0,
        users: new Set()
      };
    }

    projectMap[projId].totalHours += entry.hours;
    projectMap[projId].entries += 1;
    projectMap[projId].users.add(entry.accountId);

    if (entry.billable) {
      projectMap[projId].billableHours += entry.hours;
    } else {
      projectMap[projId].nonBillableHours += entry.hours;
    }
  });

  // Convert to array and calculate percentages
  const projectData = Object.values(projectMap).map(proj => ({
    ...proj,
    users: proj.users.size,
    billablePercentage: proj.totalHours > 0 ?
      ((proj.billableHours / proj.totalHours) * 100).toFixed(1) : 0,
    totalHours: proj.totalHours.toFixed(1),
    billableHours: proj.billableHours.toFixed(1),
    nonBillableHours: proj.nonBillableHours.toFixed(1)
  }));

  // Sort by total hours descending
  projectData.sort((a, b) => parseFloat(b.totalHours) - parseFloat(a.totalHours));

  return projectData;
}

/**
 * Generate by-user report
 */
function generateByUserReport(entries, accounts, getUserName) {
  const userMap = {};

  entries.forEach(entry => {
    const userId = entry.accountId;
    if (!userMap[userId]) {
      userMap[userId] = {
        userId: userId,
        userName: getUserName(userId),
        totalHours: 0,
        billableHours: 0,
        nonBillableHours: 0,
        entries: 0,
        projects: new Set()
      };
    }

    userMap[userId].totalHours += entry.hours;
    userMap[userId].entries += 1;
    userMap[userId].projects.add(entry.projectId);

    if (entry.billable) {
      userMap[userId].billableHours += entry.hours;
    } else {
      userMap[userId].nonBillableHours += entry.hours;
    }
  });

  // Convert to array and calculate percentages
  const userData = Object.values(userMap).map(user => ({
    ...user,
    projects: user.projects.size,
    billablePercentage: user.totalHours > 0 ?
      ((user.billableHours / user.totalHours) * 100).toFixed(1) : 0,
    totalHours: user.totalHours.toFixed(1),
    billableHours: user.billableHours.toFixed(1),
    nonBillableHours: user.nonBillableHours.toFixed(1)
  }));

  // Sort by total hours descending
  userData.sort((a, b) => parseFloat(b.totalHours) - parseFloat(a.totalHours));

  return userData;
}

/**
 * Generate trends report (configurable frequency)
 * Fills in missing periods with 0 values
 */
function generateTrendsReport(entries, frequency = 'weekly', startDate, endDate) {
  const groupMap = {};

  // 1. Determine date range
  let start = startDate ? moment(startDate) : moment().subtract(30, 'days');
  let end = endDate ? moment(endDate) : moment();

  // If no explicit dates and we have entries, rely on entry dates if needed, 
  // but usually reports have a default range. 
  // If we want to strictly follow the data range when no filter is applied:
  if (!startDate && entries.length > 0) {
    const sorted = [...entries].sort((a, b) => new Date(a.workDate) - new Date(b.workDate));
    start = moment(sorted[0].workDate);
    end = moment(sorted[sorted.length - 1].workDate);
  }

  // Adjust start/end to period boundaries
  switch (frequency) {
    case 'weekly':
      start.startOf('isoWeek');
      end.endOf('isoWeek');
      break;
    case 'monthly':
      start.startOf('month');
      end.endOf('month');
      break;
    case 'yearly':
      start.startOf('year');
      end.endOf('year');
      break;
    default: // daily
      // no adjustment needed
      break;
  }

  // 2. Initialize all periods with 0
  const current = start.clone();
  while (current.isSameOrBefore(end)) {
    let periodStart;

    switch (frequency) {
      case 'daily':
        periodStart = current.format('YYYY-MM-DD');
        current.add(1, 'days');
        break;
      case 'monthly':
        periodStart = current.format('YYYY-MM-DD');
        current.add(1, 'months');
        break;
      case 'yearly':
        periodStart = current.format('YYYY');
        current.add(1, 'years');
        break;
      case 'weekly':
      default:
        periodStart = current.format('YYYY-MM-DD');
        current.add(1, 'weeks');
        break;
    }

    groupMap[periodStart] = {
      periodStart,
      totalHours: 0,
      billableHours: 0,
      nonBillableHours: 0,
      entries: 0
    };
  }

  // 3. Populate with actual data
  entries.forEach(entry => {
    let periodStart;
    const date = moment(entry.workDate);

    switch (frequency) {
      case 'daily':
        periodStart = date.format('YYYY-MM-DD');
        break;
      case 'monthly':
        periodStart = date.startOf('month').format('YYYY-MM-DD');
        break;
      case 'yearly':
        periodStart = date.startOf('year').format('YYYY');
        break;
      case 'weekly':
      default:
        periodStart = date.startOf('isoWeek').format('YYYY-MM-DD');
        break;
    }

    if (groupMap[periodStart]) {
      groupMap[periodStart].totalHours += entry.hours;
      groupMap[periodStart].entries += 1;

      if (entry.billable) {
        groupMap[periodStart].billableHours += entry.hours;
      } else {
        groupMap[periodStart].nonBillableHours += entry.hours;
      }
    }
  });

  // Convert to array and format
  const trendData = Object.values(groupMap).map(group => ({
    ...group,
    totalHours: group.totalHours.toFixed(1),
    billableHours: group.billableHours.toFixed(1),
    nonBillableHours: group.nonBillableHours.toFixed(1)
  }));

  // Sort chronologically
  trendData.sort((a, b) => a.periodStart.localeCompare(b.periodStart));

  return trendData;
}

/**
 * Get top projects by hours
 */
function getTopProjects(entries, projects, limit = 5) {
  const projectHours = {};

  entries.forEach(entry => {
    if (!projectHours[entry.projectId]) {
      projectHours[entry.projectId] = 0;
    }
    projectHours[entry.projectId] += entry.hours;
  });

  const sorted = Object.entries(projectHours)
    .map(([projectId, hours]) => {
      const project = projects.find(p => p.$id === projectId);
      return {
        projectId,
        projectName: project ? `${project.code} - ${project.name}` : projectId,
        hours: hours.toFixed(1)
      };
    })
    .sort((a, b) => parseFloat(b.hours) - parseFloat(a.hours))
    .slice(0, limit);

  return sorted;
}

/**
 * Get top users by hours
 */
function getTopUsers(entries, accounts, limit = 5) {
  const userHours = {};

  entries.forEach(entry => {
    if (!userHours[entry.accountId]) {
      userHours[entry.accountId] = 0;
    }
    userHours[entry.accountId] += entry.hours;
  });

  const sorted = Object.entries(userHours)
    .map(([userId, hours]) => {
      const account = accounts.find(a => a.accountId === userId);
      return {
        userId,
        userName: account ? `${account.firstName} ${account.lastName}` : userId,
        hours: hours.toFixed(1)
      };
    })
    .sort((a, b) => parseFloat(b.hours) - parseFloat(a.hours))
    .slice(0, limit);

  return sorted;
}

/**
 * Generate CSV from report data
 */
function generateCSV(data, type) {
  let csv = '';

  switch (type) {
    case 'by-project':
      csv = 'Project,Total Hours,Billable Hours,Non-Billable Hours,Billable %,Entries,Users\n';
      data.forEach(row => {
        csv += `"${row.projectName}",${row.totalHours},${row.billableHours},${row.nonBillableHours},${row.billablePercentage},${row.entries},${row.users}\n`;
      });
      break;

    case 'by-user':
      csv = 'User,Total Hours,Billable Hours,Non-Billable Hours,Billable %,Entries,Projects\n';
      data.forEach(row => {
        csv += `"${row.userName}",${row.totalHours},${row.billableHours},${row.nonBillableHours},${row.billablePercentage},${row.entries},${row.projects}\n`;
      });
      break;

    case 'trends':
      csv = 'Period Start,Total Hours,Billable Hours,Non-Billable Hours,Entries\n';
      data.forEach(row => {
        csv += `${row.periodStart},${row.totalHours},${row.billableHours},${row.nonBillableHours},${row.entries}\n`;
      });
      break;

    case 'summary':
      csv = 'Metric,Value\n';
      csv += `Total Hours,${data.summary.totalHours}\n`;
      csv += `Billable Hours,${data.summary.billableHours}\n`;
      csv += `Non-Billable Hours,${data.summary.nonBillableHours}\n`;
      csv += `Billable Percentage,${data.summary.billablePercentage}%\n`;
      csv += `Total Entries,${data.summary.totalEntries}\n`;
      csv += `Unique Users,${data.summary.uniqueUsers}\n`;
      csv += `Unique Projects,${data.summary.uniqueProjects}\n`;
      csv += `Average Hours Per User,${data.summary.avgHoursPerUser}\n`;
      csv += `This Week Hours,${data.summary.thisWeekHours}\n`;
      csv += `This Month Hours,${data.summary.thisMonthHours}\n`;
      break;

    default:
      csv = 'No data\n';
  }

  return csv;
}
