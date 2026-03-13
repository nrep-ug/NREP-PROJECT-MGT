/**
 * Bulk Timesheets Operations API
 * POST: Bulk approve or reject multiple timesheets
 */

import { NextResponse } from 'next/server';
import { adminDatabases, adminUsers, DB_ID } from '@/lib/appwriteAdmin';
import { nowUTC, formatDate } from '@/lib/date';

const COL_TIMESHEETS = 'pms_timesheets';

/**
 * Helper function to send notification
 */
async function sendNotification(type, data) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const headers = { 'Content-Type': 'application/json' };
    if (process.env.INTERNAL_API_SECRET) {
      headers['x-internal-secret'] = process.env.INTERNAL_API_SECRET;
    }
    const response = await fetch(`${baseUrl}/api/notifications/timesheets`, {
      method: 'POST',
      headers,
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
 * POST /api/timesheets/bulk
 * Bulk approve or reject multiple timesheets
 *
 * Body:
 * - timesheetIds: Array of timesheet IDs
 * - action: 'approve' or 'reject'
 * - managerId: ID of the manager performing the action
 * - rejectionComments: Optional comments (required for reject)
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { timesheetIds, action, managerId, rejectionComments, approvalComments } = body;

    if (!timesheetIds || !Array.isArray(timesheetIds) || timesheetIds.length === 0) {
      return NextResponse.json(
        { error: 'timesheetIds array is required' },
        { status: 400 }
      );
    }

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be either "approve" or "reject"' },
        { status: 400 }
      );
    }

    if (!managerId) {
      return NextResponse.json(
        { error: 'managerId is required' },
        { status: 401 }
      );
    }

    if (action === 'reject' && (!rejectionComments || rejectionComments.trim().length === 0)) {
      return NextResponse.json(
        { error: 'rejectionComments is required when rejecting timesheets' },
        { status: 400 }
      );
    }

    if (action === 'approve' && (!approvalComments || approvalComments.trim().length === 0)) {
      return NextResponse.json(
        { error: 'approvalComments is required when approving timesheets' },
        { status: 400 }
      );
    }

    // Verify manager has permission (admin or project manager)
    const manager = await adminUsers.get(managerId);
    const isAdmin = manager.labels?.includes('admin');

    // If not admin, get the projects they manage
    let managedProjectIds = [];
    if (!isAdmin) {
      const COL_PROJECTS = 'pms_projects';
      const { Query, adminTeams } = require('@/lib/appwriteAdmin');

      const projectsResponse = await adminDatabases.listDocuments(DB_ID, COL_PROJECTS, []);

      for (const project of projectsResponse.documents) {
        if (project.projectTeamId) {
          try {
            const memberships = await adminTeams.listMemberships(project.projectTeamId);
            const membership = memberships.memberships.find(
              m => m.userId === managerId && m.roles.includes('manager')
            );
            if (membership) {
              managedProjectIds.push(project.$id);
            }
          } catch (err) {
            console.error(`Error checking team ${project.projectTeamId}:`, err);
          }
        }
      }

      if (managedProjectIds.length === 0) {
        return NextResponse.json(
          { error: 'Unauthorized - you are not a manager of any projects' },
          { status: 403 }
        );
      }
    }

    // Process each timesheet
    const results = {
      succeeded: [],
      failed: []
    };

    const COL_ENTRIES = 'pms_timesheet_entries';

    for (const timesheetId of timesheetIds) {
      try {
        // Get the timesheet
        const timesheet = await adminDatabases.getDocument(DB_ID, COL_TIMESHEETS, timesheetId);

        // Check if timesheet is in submitted status
        if (timesheet.status !== 'submitted') {
          results.failed.push({
            timesheetId,
            error: `Timesheet is ${timesheet.status}, not submitted`
          });
          continue;
        }

        // If PM, check if they manage all projects in this timesheet
        if (!isAdmin) {
          const { Query: QueryImport } = require('@/lib/appwriteAdmin');
          const entriesResponse = await adminDatabases.listDocuments(
            DB_ID,
            COL_ENTRIES,
            [QueryImport.equal('timesheetId', timesheetId)]
          );

          const timesheetProjectIds = [...new Set(entriesResponse.documents.map(e => e.projectId))];
          const canApproveAll = timesheetProjectIds.every(projId => managedProjectIds.includes(projId));

          if (!canApproveAll) {
            results.failed.push({
              timesheetId,
              error: 'Unauthorized - you do not manage all projects in this timesheet'
            });
            continue;
          }
        }

        // Prepare updates based on action — respect 2-step approval flow
        const updates = {};

        if (action === 'approve') {
          // Get submitter's user profile to check supervisor setting
          const { Query: Q2 } = require('@/lib/appwriteAdmin');
          const userProfiles = await adminDatabases.listDocuments(DB_ID, 'pms_users', [
            Q2.equal('accountId', timesheet.accountId),
            Q2.limit(1)
          ]);
          const userProfile = userProfiles.documents[0];
          const supervisorId = userProfile?.supervisorId;

          const isSupervisor = supervisorId === managerId;
          const needsSupervisorApproval = supervisorId && timesheet.supervisorApproval === false;

          if (needsSupervisorApproval) {
            if (isSupervisor) {
              // Supervisor approves step 1
              updates.supervisorApproval = true;
              updates.supervisorApproverId = managerId;
              updates.supervisorApprovedAt = nowUTC();
              updates.supervisorComments = approvalComments;
              updates.status = 'submitted'; // Still pending admin
            } else if (isAdmin) {
              // Admin cannot approve step 1 if they are not the supervisor
              results.failed.push({
                timesheetId,
                error: 'This timesheet is pending Supervisor approval first'
              });
              continue;
            } else {
              results.failed.push({
                timesheetId,
                error: 'Not authorized: Supervisor approval required first'
              });
              continue;
            }
          } else {
            // Step 2: Admin final approval
            if (!isAdmin) {
              results.failed.push({
                timesheetId,
                error: 'Final approval requires Admin privileges'
              });
              continue;
            }
            updates.adminApproval = true;
            updates.adminApproverId = managerId;
            updates.adminApprovedAt = nowUTC();
            updates.adminComments = approvalComments;
            updates.status = 'approved';
          }

          updates.rejectionComments = null; // Clear previous rejection
        } else if (action === 'reject') {
          updates.status = 'rejected';
          updates.rejectionComments = rejectionComments;
          updates.rejectedBy = managerId;
          updates.rejectedAt = nowUTC();
          updates.approvalComments = null;
        }

        // Update the timesheet
        const updatedTimesheet = await adminDatabases.updateDocument(
          DB_ID,
          COL_TIMESHEETS,
          timesheetId,
          updates
        );

        results.succeeded.push({
          timesheetId,
          action,
          status: updates.status
        });

        // Send notification to employee
        try {
          const employee = await adminUsers.get(updatedTimesheet.accountId);
          const manager = await adminUsers.get(managerId);

          if (action === 'approve') {
            await sendNotification('timesheet_approved', {
              to: employee.email,
              employeeName: employee.name,
              weekStart: formatDate(updatedTimesheet.weekStart),
              approvedBy: manager.name
            });
          } else if (action === 'reject') {
            await sendNotification('timesheet_rejected', {
              to: employee.email,
              employeeName: employee.name,
              weekStart: formatDate(updatedTimesheet.weekStart),
              rejectedBy: manager.name,
              comments: rejectionComments
            });
          }
        } catch (notificationError) {
          console.error(`[Notification Error for ${timesheetId}]`, notificationError);
          // Don't fail the bulk operation if notification fails
        }
      } catch (error) {
        console.error(`Failed to ${action} timesheet ${timesheetId}:`, error);
        results.failed.push({
          timesheetId,
          error: error.message || `Failed to ${action} timesheet`
        });
      }
    }

    const successCount = results.succeeded.length;
    const failCount = results.failed.length;

    return NextResponse.json({
      message: `Bulk ${action}: ${successCount} succeeded, ${failCount} failed`,
      results
    });
  } catch (error) {
    console.error('[API /timesheets/bulk POST]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process bulk operation' },
      { status: 500 }
    );
  }
}
