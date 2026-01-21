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

    // Determine collection based on type
    let collectionId = COL_ORGANIZATIONS;
    if (type === 'client') {
      collectionId = 'pms_clients';
    }

    // Build queries
    const queries = [
      Query.orderAsc('name'),
      Query.limit(200)
    ];

    // Only add type filter if we are NOT using the dedicated clients collection
    // (since pms_clients doesn't have a 'type' field, they are all clients)
    if (type && type !== 'client') {
      queries.push(Query.equal('type', type));
    }

    // For clients, we might want to filter by status if needed, but usually we want all active ones
    if (type === 'client') {
      queries.push(Query.notEqual('status', 'suspended'));
    }

    const organizations = await adminDatabases.listDocuments(
      DB_ID,
      collectionId,
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
