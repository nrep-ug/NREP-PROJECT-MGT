/**
 * Staff API - Get list of staff members in organization
 * GET: List all staff members (users with 'staff' or 'admin' label) in an organization
 * Note: Uses Appwrite labels, not team roles
 */

import { NextResponse } from 'next/server';
import { COLLECTIONS, adminDatabases, adminUsers, Query, DB_ID } from '@/lib/appwriteAdmin';
import { verifyStaffAccess } from '@/lib/authHelpers';

export const dynamic = 'force-dynamic';

const COL_USERS = COLLECTIONS.USERS;

/**
 * GET /api/staff
 * Get all staff members in an organization with their labels (roles)
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
        { error: 'Forbidden: Only staff members can list staff' },
        { status: 403 }
      );
    }

    // Fetch all active users in the organization
    const users = await adminDatabases.listDocuments(
      DB_ID,
      COL_USERS,
      [
        Query.equal('organizationId', organizationId),
        Query.equal('status', 'active')
      ]
    );

    // Fetch auth user details for each user to get their labels
    const staffMembers = await Promise.all(
      users.documents.map(async (user) => {
        try {
          // Get auth user to retrieve labels
          const authUser = await adminUsers.get(user.accountId);
          const labels = authUser.labels || [];

          // Check if user has 'staff' or 'admin' label
          const isStaff = labels.includes('staff') || labels.includes('admin');

          return {
            ...user,
            labels: labels,
            roles: labels, // For backward compatibility
            isStaff
          };
        } catch (error) {
          console.error(`Failed to fetch auth user for ${user.email}:`, error);
          return {
            ...user,
            labels: [],
            roles: [],
            isStaff: false
          };
        }
      })
    );

    // Filter to only include staff members (users with 'staff' or 'admin' label)
    const filteredStaff = staffMembers.filter(user => user.isStaff);

    return NextResponse.json({
      staff: filteredStaff,
      total: filteredStaff.length
    });
  } catch (error) {
    console.error('[API /staff GET]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch staff' },
      { status: 500 }
    );
  }
}
