import { handleFinanceRequest, readJson } from '@/lib/financeRoute';
import { createCommitment, listCommitments } from '@/lib/financeService';

export async function GET(request) {
  return handleFinanceRequest(request, (context) => {
    const { searchParams } = new URL(request.url);
    return listCommitments(context, {
      projectId: searchParams.get('projectId'),
      budgetLineId: searchParams.get('budgetLineId'),
      activityId: searchParams.get('activityId'),
      status: searchParams.get('status'),
    }).then((commitments) => ({ commitments, total: commitments.length }));
  });
}

export async function POST(request) {
  return handleFinanceRequest(request, async (context) => ({
    commitment: await createCommitment(context, await readJson(request)),
  }), { status: 201 });
}
