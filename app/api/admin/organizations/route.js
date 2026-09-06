/**
 * Admin Organizations API
 * GET: Fetch all organizations (for dropdowns, etc.)
 */

import { NextResponse } from 'next/server';
import { COLLECTIONS, adminDatabases, Query, DB_ID } from '@/lib/appwriteAdmin';
import { apiErrorResponse, requireAdmin, requireAuthenticatedContext } from '@/lib/serverAuth';

const COL_ORGANIZATIONS = COLLECTIONS.ORGANIZATIONS;

/**
 * GET /api/admin/organizations
 * Fetch all organizations (admin only)
 */
export async function GET(request) {
  try {
    const context = await requireAuthenticatedContext(request);
    requireAdmin(context);
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'client' or 'staff' or undefined for all
    if (type && !['client', 'staff'].includes(type)) {
      return NextResponse.json({ error: 'type must be client or staff.' }, { status: 400 });
    }

    // Determine collection based on type
    let collectionId = COL_ORGANIZATIONS;
    if (type === 'client') {
      collectionId = COLLECTIONS.CLIENTS;
    }

    // Build queries
    const queries = [Query.orderAsc('name'), Query.limit(200)];
    if (type === 'client') {
      queries.push(Query.equal('organizationId', context.organizationId));
    } else {
      queries.push(Query.equal('$id', context.organizationId));
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
    const response = apiErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
