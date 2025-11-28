/**
 * Admin Organizations API
 * GET: Fetch all organizations (for dropdowns, etc.)
 */

import { NextResponse } from 'next/server';
import { adminDatabases, adminUsers, Query, DB_ID } from '@/lib/appwriteAdmin';

const COL_ORGANIZATIONS = 'pms_organizations';

/**
 * GET /api/admin/organizations
 * Fetch all organizations (admin only)
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const requesterId = searchParams.get('requesterId');
    const type = searchParams.get('type'); // 'client' or 'staff' or undefined for all

    if (!requesterId) {
      return NextResponse.json(
        { error: 'requesterId is required' },
        { status: 400 }
      );
    }

    // Verify requester is admin
    const requester = await adminUsers.get(requesterId);
    if (!requester.labels?.includes('admin')) {
      return NextResponse.json(
        { error: 'Only admins can view organizations' },
        { status: 403 }
      );
    }

    // Build queries
    const queries = [
      Query.orderAsc('name'),
      Query.limit(200)
    ];

    if (type) {
      queries.push(Query.equal('type', type));
    }

    const organizations = await adminDatabases.listDocuments(
      DB_ID,
      COL_ORGANIZATIONS,
      queries
    );

    return NextResponse.json({
      success: true,
      organizations: organizations.documents
    });
  } catch (error) {
    console.error('[API /admin/organizations GET]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch organizations' },
      { status: 500 }
    );
  }
}
