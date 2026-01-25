/**
 * Accounts API
 * GET: Fetch user accounts for an organization
 */

import { NextResponse } from 'next/server';
import { adminDatabases, Query, DB_ID } from '@/lib/appwriteAdmin';

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

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
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
