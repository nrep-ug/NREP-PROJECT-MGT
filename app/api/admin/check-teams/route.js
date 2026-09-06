/**
 * Check Teams API - Verify if teams have been bootstrapped
 * GET: Check if initial teams exist
 */

import { NextResponse } from 'next/server';
import { adminTeams } from '@/lib/appwriteAdmin';
import { apiErrorResponse, requireAdmin, requireAuthenticatedContext } from '@/lib/serverAuth';

export async function GET(request) {
  try {
    const context = await requireAuthenticatedContext(request);
    requireAdmin(context);
    const team = await adminTeams.get(context.organizationId);

    return NextResponse.json({
      exist: Boolean(team),
      total: team ? 1 : 0,
    });
  } catch (error) {
    console.error('[API /admin/check-teams]', error);
    const response = apiErrorResponse(error);
    return NextResponse.json({ ...response.body, exist: false }, { status: response.status });
  }
}
