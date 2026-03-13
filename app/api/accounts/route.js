/**
 * Accounts API
 * GET: Fetch user accounts for an organization
 */

import { NextResponse } from 'next/server';
import { adminDatabases, Query, DB_ID } from '@/lib/appwriteAdmin';
import { verifyStaffAccess } from '@/lib/authHelpers';

export const dynamic = 'force-dynamic';

const COL_USERS = 'pms_users';

/**
 * GET /api/accounts
 * Fetch all user accounts for an organization
 * Query params:
 *   - organizationId (required)
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const requesterId = searchParams.get('requesterId');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

    if (!requesterId) {
      return NextResponse.json(
        { error: 'Unauthorized: requesterId is required' },
        { status: 401 }
      );
    }

    const isStaff = await verifyStaffAccess(requesterId);
    if (!isStaff) {
      return NextResponse.json(
        { error: 'Forbidden: Only staff members can list accounts' },
        { status: 403 }
      );
    }

    // Fetch all users in this organization
    // Note: Only staff and admin users have organizationId set
    // Client users have clientOrganizationId instead
    const users = await adminDatabases.listDocuments(DB_ID, COL_USERS, [
      Query.equal('organizationId', organizationId),
      Query.equal('status', 'active'),
      Query.equal('userType', 'staff'), // Exclude clients
      Query.orderAsc('firstName'),
      Query.limit(500)
    ]);

    return NextResponse.json({
      success: true,
      accounts: users.documents,
      total: users.total
    });
  } catch (error) {
    console.error('[API /accounts GET]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch accounts' },
      { status: 500 }
    );
  }
}
