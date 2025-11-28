/**
 * Check Teams API - Verify if teams have been bootstrapped
 * GET: Check if initial teams exist
 */

import { NextResponse } from 'next/server';
import { adminTeams } from '@/lib/appwriteAdmin';

export async function GET(request) {
  try {
    // Try to list teams to see if any exist
    const teamsResponse = await adminTeams.list();

    // If we have at least 3 teams (admin, staff, client), consider it bootstrapped
    const exist = teamsResponse.total >= 3;

    return NextResponse.json({
      exist,
      total: teamsResponse.total,
    });
  } catch (error) {
    console.error('[API /admin/check-teams]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check teams', exist: false },
      { status: 500 }
    );
  }
}
