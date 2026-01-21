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

    // Fetch existing timesheet and user to determine context
    const timesheet = await adminDatabases.getDocument(DB_ID, COL_TIMESHEETS, timesheetId);
    const employee = await adminUsers.get(timesheet.accountId);

    // We need the user profile (from database) to check supervisorId, as account object doesn't have it
    const userProfiles = await adminDatabases.listDocuments(DB_ID, 'pms_users', [
      Query.equal('accountId', timesheet.accountId),
      Query.limit(1)
    ]);
    const userProfile = userProfiles.documents[0];
    const supervisorId = userProfile?.supervisorId;

    const updates = {};
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    if (action === 'submit') {
      updates.status = 'submitted';
      updates.submittedAt = nowUTC();
      updates.rejectionComments = null;
      updates.approvalComments = null; // Clear old final comments

      // Determine flow based on supervisor
      if (supervisorId) {
        updates.supervisorApproval = false; // Pending Supervisor
        updates.supervisorApproverId = null;
        updates.supervisorComments = null;
        updates.supervisorApprovedAt = null;

        updates.adminApproval = false;      // Pending Admin (subsequent)
      } else {
        updates.supervisorApproval = null;  // Not applicable
        updates.supervisorApproverId = null;
        updates.supervisorComments = null;
        updates.supervisorApprovedAt = null;

        updates.adminApproval = false;      // Pending Admin (direct)
      }

      updates.adminApproverId = null;
      updates.adminComments = null;
      updates.adminApprovedAt = null;

    } else if (action === 'approve') {
      if (!managerId) {
        return NextResponse.json({ error: 'managerId required for approval' }, { status: 400 });
      }
      if (!approvalComments || approvalComments.trim().length === 0) {
        return NextResponse.json(
          { error: 'Approval comments are required when approving a timesheet' },
          { status: 400 }
        );
      }

      // Check permissions and stage
      const approverUser = await adminUsers.get(managerId);
      // To check if approver is supervisor, we need their pms_users profile or just compare accountId
      // The `supervisorId` in userProfile is the accountId of the supervisor

      const isSupervisor = supervisorId === managerId;
      const isAdmin = approverUser.labels?.includes('admin');

      // Logic for 2-step approval
      // Step 1: Supervisor Approval
      // Needed if: supervisorId exists AND supervisorApproval is false (not null)
      const needsSupervisorApproval = supervisorId && timesheet.supervisorApproval === false;

      if (needsSupervisorApproval) {
        // Only Supervisor or Admin can approve (Admins can override? User implied 2 steps. 
        // But if I am Admin I might just see it. For now, strict: If I am the supervisor, I approve step 1.
        // If I am Admin but NOT supervisor, can I approve step 1?
        // User said: "Admins are able to approve timesheets approved at the supervisor level" -> Implies Admin waits.
        // But the user also said: "A user can be Admin, and also supervisor... 2 levels of approval".
        // So checking strict role.

        if (isSupervisor) {
          updates.supervisorApproval = true;
          updates.supervisorApproverId = managerId;
          updates.supervisorApprovedAt = nowUTC();
          updates.supervisorComments = approvalComments;

          // STATUS remains 'submitted' because it is still pending Admin
          updates.status = 'submitted';

        } else if (isAdmin) {
          // If Admin tries to approve a generic timesheet that is waiting for supervisor...
          // Technically they should be blocked or it counts as Override.
          // Given user instructions, let's assume standard flow: Admin generally approves step 2.
          // But if specific request, maybe allow override.
          // SAFEST BET: Block non-supervisor admins from step 1, OR allow them to perform step 1 "on behalf".
          // Let's assume strict separation for now as requested.
          return NextResponse.json({ error: 'This timesheet is pending Supervisor approval.' }, { status: 403 });
        } else {
          return NextResponse.json({ error: 'Not authorized to approve (Supervisor required)' }, { status: 403 });
        }
      } else {
        // Step 2: Admin Approval
        // Needed if: supervisorApproval is true OR null (meaning skipped/done) AND adminApproval is false
        // And status is submitted

        if (!isAdmin) {
          return NextResponse.json({ error: 'Final approval requires Admin privileges' }, { status: 403 });
        }

        updates.adminApproval = true;
        updates.adminApproverId = managerId;
        updates.adminApprovedAt = nowUTC();
        updates.adminComments = approvalComments;

        updates.status = 'approved'; // Final Status
      }

    } else if (action === 'reject') {
      if (!managerId) {
        return NextResponse.json({ error: 'managerId required for rejection' }, { status: 400 });
      }
      if (!rejectionComments || rejectionComments.trim().length === 0) {
        return NextResponse.json(
          { error: 'Rejection comments are required when rejecting a timesheet' },
          { status: 400 }
        );
      }

      updates.status = 'rejected';
      updates.rejectedBy = managerId;
      updates.rejectedAt = nowUTC();
      updates.rejectionComments = rejectionComments;

      // Reset approvals as requested
      // "reset ... admin & supervisor related attributes to default"
      if (supervisorId) {
        updates.supervisorApproval = false;
        updates.supervisorApproverId = null;
        updates.supervisorComments = null;
        updates.supervisorApprovedAt = null;
      } else {
        updates.supervisorApproval = null;
      }

      updates.adminApproval = false;
      updates.adminApproverId = null;
      updates.adminComments = null;
      updates.adminApprovedAt = null;

      // Clear approval comments (since it's now rejected)
      updates.approvalComments = null;

    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const updatedTimesheet = await adminDatabases.updateDocument(DB_ID, COL_TIMESHEETS, timesheetId, updates);

    // Notifications
    // ... (This logic needs to be sophisticated too)
    try {
      // Re-fetch logic for notifications as state changed
      if (action === 'submit') {
        // Notify Supervisor if exists, else Admin
        const entries = await adminDatabases.listDocuments(DB_ID, COL_ENTRIES, [
          Query.equal('timesheetId', timesheetId)
        ]);
        const totalHours = entries.documents.reduce((sum, entry) => sum + (entry.hours || 0), 0);

        if (supervisorId) {
          // Notify Supervisor
          // Need supervisor email.
          // supervisorId is an accountId.
          const supervisorUser = await adminUsers.get(supervisorId);
          await sendNotification('timesheet_submitted', {
            to: supervisorUser.email,
            employeeName: employee.name,
            weekStart: formatDate(timesheet.weekStart),
            totalHours: totalHours.toFixed(2),
            approvalUrl: `${baseUrl}/timesheets/approvals`
          });
        } else {
          // Notify Admins
          const approvers = await getApprovers(timesheetId); // This function gets admins + PMs
          for (const approver of approvers) {
            await sendNotification('timesheet_submitted', {
              to: approver.email,
              employeeName: employee.name,
              weekStart: formatDate(timesheet.weekStart),
              totalHours: totalHours.toFixed(2),
              approvalUrl: `${baseUrl}/timesheets/approvals`
            });
          }
        }
      } else if (action === 'approve') {
        const manager = await adminUsers.get(managerId);

        if (updates.status === 'approved') {
          // Final Approval -> Notify Employee
          await sendNotification('timesheet_approved', {
            to: employee.email,
            employeeName: employee.name,
            weekStart: formatDate(timesheet.weekStart),
            approvedBy: manager.name
          });
        } else {
          // Supervisor Approved (Still Submitted) -> Notify Admins
          // 'Supervisor Approved, Pending Admin'
          const approvers = await getApprovers(timesheetId);
          for (const approver of approvers) {
            await sendNotification('timesheet_supervisor_approved', { // You might need to handle this type in notification handler or reuse submitted
              to: approver.email,
              employeeName: employee.name,
              weekStart: formatDate(timesheet.weekStart),
              supervisorName: manager.name,
              approvalUrl: `${baseUrl}/timesheets/approvals`
            });
          }
        }
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
    } catch (err) {
      console.error('[Notification Error]', err);
    }

    return NextResponse.json({ timesheet: updatedTimesheet });
  } catch (error) {
    console.error('[API /timesheets PATCH]', error);
    return NextResponse.json({ error: error.message || 'Failed to update timesheet' }, { status: 500 });
  }
}
