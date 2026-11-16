/**
 * GET /api/field/me — the signed-in champion's own profile for the portal.
 * Contains only the champion's own details.
 */
import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/lib/serverAuth';
import { requireChampionContext } from '@/lib/cleanCooking/championAccounts';

export async function GET(request) {
  try {
    const { champion, project } = await requireChampionContext(request);
    return NextResponse.json({
      fullName: champion.fullName,
      district: champion.district,
      isDistrictLead: Boolean(champion.isDistrictLead),
      project: { code: project.code, name: project.name },
    });
  } catch (error) {
    const { status, body } = apiErrorResponse(error);
    if (status >= 500) console.error('[field/me]', error);
    return NextResponse.json(body, { status });
  }
}
