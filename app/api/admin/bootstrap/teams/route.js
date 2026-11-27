/**
 * Admin API - Run teams bootstrap
 * POST: Trigger teams-bootstrap script
 */

import { NextResponse } from 'next/server';
import { adminTeams } from '@/lib/appwriteAdmin';
import { apiErrorResponse, requireAdmin, requireAuthenticatedContext } from '@/lib/serverAuth';

export async function POST(request) {
  try {
    const context = await requireAuthenticatedContext(request);
    requireAdmin(context);

    const team = await adminTeams.get(context.organizationId);

    return NextResponse.json({
      success: true,
      message: 'Organization team is configured.',
      team: { $id: team.$id, name: team.name },
    });
  } catch (error) {
    console.error('[API /admin/bootstrap/teams POST]', error);
    const response = apiErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
