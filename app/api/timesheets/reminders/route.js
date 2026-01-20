/**
 * Timesheet Reminders API
 * POST: Send reminder emails to staff who haven't submitted timesheets
 */

import { NextResponse } from 'next/server';
import { adminUsers, adminDatabases, Query, DB_ID } from '@/lib/appwriteAdmin';
import { formatDate } from '@/lib/date';

export const dynamic = 'force-dynamic';

const COL_USERS = 'pms_users';

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
        }
    } catch (error) {
        console.error('[Notification Failed]', error);
    }
}

/**
 * POST /api/timesheets/reminders
 * Send bulk reminders
 */
export async function POST(request) {
    try {
        const body = await request.json();
        const { weekStart, staffIds, organizationId } = body;

        if (!weekStart || !staffIds || !Array.isArray(staffIds) || !organizationId) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Fetch user details for emails
        const usersResponse = await adminDatabases.listDocuments(
            DB_ID,
            COL_USERS,
            [
                Query.equal('accountId', staffIds),
                Query.equal('organizationId', organizationId),
                Query.limit(100)
            ]
        );

        const users = usersResponse.documents;
        const emailPromises = [];

        for (const user of users) {
            // Send reminder notification
            emailPromises.push(
                sendNotification('timesheet_reminder', {
                    to: user.email,
                    employeeName: user.firstName,
                    weekStart: formatDate(weekStart),
                    dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/timesheets/my`
                })
            );
        }

        await Promise.allSettled(emailPromises);

        return NextResponse.json({
            success: true,
            count: emailPromises.length,
            message: `Sent reminders to ${emailPromises.length} staff members`
        });
    } catch (error) {
        console.error('[API /timesheets/reminders POST]', error);
        return NextResponse.json(
            { error: error.message || 'Failed to send reminders' },
            { status: 500 }
        );
    }
}
