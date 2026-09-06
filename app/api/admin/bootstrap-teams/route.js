/**
 * Bootstrap Teams API - Run teams bootstrap script
 * POST: Trigger teams bootstrap script
 */

import { NextResponse } from 'next/server';
import { adminTeams } from '@/lib/appwriteAdmin';
import { apiErrorResponse, requireAdmin, requireAuthenticatedContext } from '@/lib/serverAuth';

export async function POST(request) {
  try {
    const context = await requireAuthenticatedContext(request);
    requireAdmin(context);
    const body = await request.json();
    const { organizationId } = body;

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }
    if (organizationId !== context.organizationId) {
      return NextResponse.json(
        { error: 'Teams can only be bootstrapped for your organization.' },
        { status: 403 }
      );
    }

    // Authenticated users can only reach this route after Appwrite confirms
    // membership in this exact organization team. Verify that team directly;
    // never launch the interactive bootstrap CLI from an HTTP request.
    const team = await adminTeams.get(context.organizationId);

    return NextResponse.json({
      success: true,
      message: 'Organization team is configured.',
      team: { $id: team.$id, name: team.name },
    });
  } catch (error) {
    console.error('[API /admin/bootstrap-teams] Error:', error);
    const response = apiErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
