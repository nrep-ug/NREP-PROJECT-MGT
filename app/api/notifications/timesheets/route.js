/**
 * Notifications API
 * POST: Send email notifications
 *
 * Note: Install nodemailer first: npm install nodemailer
 * Configure environment variables in .env.local:
 *   EMAIL_HOST=smtp.gmail.com
 *   EMAIL_PORT=587
 *   EMAIL_USER=your-email@gmail.com
 *   EMAIL_PASSWORD=your-app-password
 *   EMAIL_FROM=NREP PMS <noreply@nrep.com>
 */

import { NextResponse } from 'next/server';
import {
  sendTimesheetSubmittedEmail,
  sendTimesheetApprovedEmail,
  sendTimesheetSupervisorApprovedEmail,
  sendTimesheetRejectedEmail,
} from '@/lib/nodemailer';

/**
 * POST /api/notifications/timesheets
 * Send email notifications
 *
 * Body:
 * - type: 'timesheet_submitted' | 'timesheet_approved' | 'timesheet_rejected' | 'timesheet_supervisor_approved'
 * - data: Object with relevant notification data
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { type, data } = body;

    if (!type || !data) {
      return NextResponse.json(
        { error: 'type and data are required' },
        { status: 400 }
      );
    }

    let result;

    switch (type) {
      case 'timesheet_submitted':
        // Send to managers
        if (!data.to || !data.employeeName || !data.weekStart || !data.totalHours || !data.approvalUrl) {
          return NextResponse.json(
            { error: 'Missing required fields for timesheet_submitted notification' },
            { status: 400 }
          );
        }
        result = await sendTimesheetSubmittedEmail(data);
        break;

      case 'timesheet_approved':
        // Send to employee
        if (!data.to || !data.employeeName || !data.weekStart || !data.approvedBy) {
          return NextResponse.json(
            { error: 'Missing required fields for timesheet_approved notification' },
            { status: 400 }
          );
        }
        result = await sendTimesheetApprovedEmail(data);
        break;

      case 'timesheet_supervisor_approved':
        // Send to admins
        if (!data.to || !data.employeeName || !data.weekStart || !data.supervisorName || !data.approvalUrl) {
          return NextResponse.json(
            { error: 'Missing required fields for timesheet_supervisor_approved notification' },
            { status: 400 }
          );
        }
        result = await sendTimesheetSupervisorApprovedEmail(data);
        break;

      case 'timesheet_rejected':
        // Send to employee
        if (!data.to || !data.employeeName || !data.weekStart || !data.rejectedBy || !data.comments) {
          return NextResponse.json(
            { error: 'Missing required fields for timesheet_rejected notification' },
            { status: 400 }
          );
        }
        result = await sendTimesheetRejectedEmail(data);
        break;

      default:
        return NextResponse.json(
          { error: `Unknown notification type: ${type}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      message: 'Notification sent successfully',
      result
    });
  } catch (error) {
    console.error('[API /notifications/timesheets POST]', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to send notification',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
