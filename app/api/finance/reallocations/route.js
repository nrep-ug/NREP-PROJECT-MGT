import { handleFinanceRequest, readJson } from '@/lib/financeRoute';
import { createReallocation, listReallocations } from '@/lib/financeService';

export async function GET(request) {
  return handleFinanceRequest(request, (context) => {
    const { searchParams } = new URL(request.url);
    return listReallocations(context, {
      projectId: searchParams.get('projectId'),
      activityId: searchParams.get('activityId'),
      status: searchParams.get('status'),
    }).then((reallocations) => ({ reallocations, total: reallocations.length }));
  });
}

export async function POST(request) {
  return handleFinanceRequest(request, async (context) => ({
    reallocation: await createReallocation(context, await readJson(request)),
  }), { status: 201 });
}

