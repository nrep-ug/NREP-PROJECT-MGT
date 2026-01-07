/**
 * Timesheets API - Upsert and Approve
 * GET: Fetch timesheet and entries for a week
 * POST: Create/update timesheet and add entries
 * PATCH: Approve or reject timesheet (manager only)
 */

import { NextResponse } from 'next/server';
import { adminDatabases, adminUsers, ID, Query, DB_ID } from '@/lib/appwriteAdmin';
import { getTimesheetPermissions } from '@/lib/rbac';
import { nowUTC } from '@/lib/date';
import { formatDate } from '@/lib/date';

const COL_TIMESHEETS = 'pms_timesheets';
const COL_ENTRIES = 'pms_timesheet_entries';

/**
 * Helper function to send notification
 */
async function sendNotification(type, data) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/notifications/timesheets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, data })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[Notification Error]', errorData);
    } else {
      console.log('[Notification Sent]', type, 'to', data.to);
    }
  } catch (error) {
    console.error('[Notification Failed]', error);
  }
}

/**
 * Get all approvers (admins + project managers for the projects in timesheet)
 */
async function getApprovers(timesheetId) {
  try {
    const approvers = [];

    // Get all admins
    const allUsers = await adminUsers.list();
    const admins = allUsers.users.filter(u => u.labels?.includes('admin'));

    for (const admin of admins) {
      approvers.push({
        email: admin.email,
        name: admin.name
      });
    }

    // Get project managers for projects in this timesheet
    const entries = await adminDatabases.listDocuments(DB_ID, COL_ENTRIES, [
      Query.equal('timesheetId', timesheetId)
    ]);

    const projectIds = [...new Set(entries.documents.map(e => e.projectId))];

    if (projectIds.length > 0) {
      const { adminTeams } = require('@/lib/appwriteAdmin');
      const COL_PROJECTS = 'pms_projects';

      for (const projectId of projectIds) {
        try {
          const project = await adminDatabases.getDocument(DB_ID, COL_PROJECTS, projectId);
          if (project.projectTeamId) {
            const memberships = await adminTeams.listMemberships(project.projectTeamId);
            for (const membership of memberships.memberships) {
              if (membership.roles.includes('manager')) {
                try {
                  const manager = await adminUsers.get(membership.userId);
                  // Check if not already added (admin might also be PM)
                  if (!approvers.find(a => a.email === manager.email)) {
                    approvers.push({
                      email: manager.email,
                      name: manager.name
                    });
                  }
                } catch (err) {
                  console.error('Error fetching manager user:', err);
                }
              }
            }
          }
        } catch (err) {
          console.error(`Error processing project ${projectId}:`, err);
        }
      }
    }

    return approvers;
  } catch (error) {
    console.error('[getApprovers Error]', error);
    return [];
  }
}

/**
 * GET /api/timesheets
 * Fetch timesheet and entries for a specific week
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    const weekStart = searchParams.get('weekStart');

    if (!accountId || !weekStart) {
      return NextResponse.json({ error: 'Missing accountId or weekStart' }, { status: 400 });
    }

    // Find timesheet for this user + week
    const timesheets = await adminDatabases.listDocuments(DB_ID, COL_TIMESHEETS, [
      Query.equal('accountId', accountId),
      Query.equal('weekStart', weekStart),
      Query.limit(1)
    ]);

    if (timesheets.documents.length === 0) {
      return NextResponse.json({ timesheet: null, entries: [] });
    }

    const timesheet = timesheets.documents[0];

    // Fetch entries
    const entriesResponse = await adminDatabases.listDocuments(DB_ID, COL_ENTRIES, [
      Query.equal('timesheetId', timesheet.$id),
      Query.orderAsc('workDate')
    ]);

    return NextResponse.json({
      timesheet,
      entries: entriesResponse.documents
    });
  } catch (error) {
    console.error('[API /timesheets GET]', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch timesheet' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { accountId, organizationId, weekStart, entries } = body;

    if (!accountId || !organizationId || !weekStart) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Find or create timesheet for this user + week
    let timesheet;
    const existing = await adminDatabases.listDocuments(DB_ID, COL_TIMESHEETS, [
      Query.equal('accountId', accountId),
      Query.equal('weekStart', weekStart),
    ]);

    if (existing.documents.length > 0) {
      timesheet = existing.documents[0];
    } else {
      // Create new timesheet
      const permissions = getTimesheetPermissions(accountId, organizationId);
      timesheet = await adminDatabases.createDocument(
        DB_ID,
        COL_TIMESHEETS,
        ID.unique(),
        {
          accountId,
          organizationId,
          weekStart,
          status: 'draft',
        },
        permissions
      );
    }

    // 2. Add entries if provided
    const createdEntries = [];
    if (entries && Array.isArray(entries) && entries.length > 0) {
      const permissions = getTimesheetPermissions(accountId, organizationId);
      for (const entry of entries) {
        // Validate hours
        if (entry.hours <= 0 || entry.hours > 24) {
          return NextResponse.json(
            { error: 'Hours must be between 0.1 and 24' },
            { status: 400 }
          );
        }

        const entryData = {
          title: entry.title,
          timesheetId: timesheet.$id,
          projectId: entry.projectId,
          taskId: entry.taskId || null,
          workDate: entry.workDate,
          hours: entry.hours,
          notes: entry.notes || null,
          billable: entry.billable !== undefined ? entry.billable : true,
          startTime: entry.startTime || null,
          endTime: entry.endTime || null
        };

        const created = await adminDatabases.createDocument(
          DB_ID,
          COL_ENTRIES,
          ID.unique(),
          entryData,
          permissions
        );
        createdEntries.push(created);
      }
    }

    return NextResponse.json({ timesheet, entries: createdEntries }, { status: 201 });
  } catch (error) {
    console.error('[API /timesheets POST]', error);
    return NextResponse.json({ error: error.message || 'Failed to create timesheet' }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const { timesheetId, action, managerId, rejectionComments, approvalComments } = body;

    if (!timesheetId || !action) {
      return NextResponse.json({ error: 'Missing timesheetId or action' }, { status: 400 });
    }

    const updates = {};

    if (action === 'submit') {
      updates.status = 'submitted';
      updates.submittedAt = nowUTC();
      // Clear previous rejection/approval comments when resubmitting
      updates.rejectionComments = null;
      updates.approvalComments = null;
    } else if (action === 'approve') {
      if (!managerId) {
        return NextResponse.json({ error: 'managerId required for approval' }, { status: 400 });
      }
      // Approval comments are required when approving
      if (!approvalComments || approvalComments.trim().length === 0) {
        return NextResponse.json(
          { error: 'Approval comments are required when approving a timesheet' },
          { status: 400 }
        );
      }
      updates.status = 'approved';
      updates.approvedBy = managerId;
      updates.approvedAt = nowUTC();
      updates.approvalComments = approvalComments;
      updates.rejectionComments = null; // Clear rejection comments on approval
    } else if (action === 'reject') {
      if (!managerId) {
        return NextResponse.json({ error: 'managerId required for rejection' }, { status: 400 });
      }
      // Rejection comments are required when rejecting
      if (!rejectionComments || rejectionComments.trim().length === 0) {
        return NextResponse.json(
          { error: 'Rejection comments are required when rejecting a timesheet' },
          { status: 400 }
        );
      }
      updates.status = 'rejected';
      updates.approvedBy = managerId;
      updates.approvedAt = nowUTC();
      updates.rejectionComments = rejectionComments;
      updates.approvalComments = null; // Clear approval comments on rejection
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const timesheet = await adminDatabases.updateDocument(DB_ID, COL_TIMESHEETS, timesheetId, updates);

    // Send notifications after successful update
    try {
      const employee = await adminUsers.get(timesheet.accountId);
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

      if (action === 'submit') {
        // Get total hours
        const entries = await adminDatabases.listDocuments(DB_ID, COL_ENTRIES, [
          Query.equal('timesheetId', timesheetId)
        ]);
        const totalHours = entries.documents.reduce((sum, entry) => sum + (entry.hours || 0), 0);

        // Get all approvers
        const approvers = await getApprovers(timesheetId);

        // Send notification to each approver
        for (const approver of approvers) {
          await sendNotification('timesheet_submitted', {
            to: approver.email,
            employeeName: employee.name,
            weekStart: formatDate(timesheet.weekStart),
            totalHours: totalHours.toFixed(2),
            approvalUrl: `${baseUrl}/timesheets/approvals`
          });
        }
      } else if (action === 'approve') {
        const manager = await adminUsers.get(managerId);
        await sendNotification('timesheet_approved', {
          to: employee.email,
          employeeName: employee.name,
          weekStart: formatDate(timesheet.weekStart),
          approvedBy: manager.name
        });
      } else if (action === 'reject') {
        const manager = await adminUsers.get(managerId);
        await sendNotification('timesheet_rejected', {
          to: employee.email,
          employeeName: employee.name,
          weekStart: formatDate(timesheet.weekStart),
          rejectedBy: manager.name,
          comments: rejectionComments
        });
      }
    } catch (notificationError) {
      console.error('[Notification Error]', notificationError);
      // Don't fail the request if notification fails
    }

    return NextResponse.json({ timesheet });
  } catch (error) {
    console.error('[API /timesheets PATCH]', error);
    return NextResponse.json({ error: error.message || 'Failed to update timesheet' }, { status: 500 });
  }
}
