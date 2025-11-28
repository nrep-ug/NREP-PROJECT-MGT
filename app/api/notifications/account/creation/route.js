
import { NextResponse } from 'next/server';
import { sendAccountCreatedEmail } from '@/lib/nodemailer';

/**
 * POST /api/notifications/account/creation
 * Send account creation email notification
 *
 * Body:
 * - to: string
 * - name: string
 * - username: string
 * - password: string
 * - loginUrl: string
 * - organizationName: string (optional)
 */
export async function POST(request) {
    try {
        const body = await request.json();
        const { to, name, username, password, loginUrl, organizationName } = body;

        if (!to || !name || !username || !password || !loginUrl) {
            return NextResponse.json(
                { error: 'Missing required fields: to, name, username, password, loginUrl' },
                { status: 400 }
            );
        }

        const result = await sendAccountCreatedEmail({
            to,
            name,
            username,
            password,
            loginUrl,
            organizationName
        });

        return NextResponse.json({
            success: true,
            message: 'Account creation notification sent successfully',
            result
        });
    } catch (error) {
        console.error('[API /notifications/account/creation POST]', error);
        return NextResponse.json(
            {
                error: error.message || 'Failed to send notification',
                details: process.env.NODE_ENV === 'development' ? error.stack : undefined
            },
            { status: 500 }
        );
    }
}
