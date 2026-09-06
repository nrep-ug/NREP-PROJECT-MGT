import { handleFinanceRequest, readJson } from '@/lib/financeRoute';
import { createVarianceExplanation, listVarianceExplanations } from '@/lib/financeService';

export async function GET(request) {
  return handleFinanceRequest(request, (context) => {
    const { searchParams } = new URL(request.url);
    return listVarianceExplanations(context, {
      projectId: searchParams.get('projectId'),
      budgetLineId: searchParams.get('budgetLineId'),
      status: searchParams.get('status'),
    }).then((explanations) => ({ explanations, total: explanations.length }));
  });
}

export async function POST(request) {
  return handleFinanceRequest(request, async (context) => ({
    explanation: await createVarianceExplanation(context, await readJson(request)),
  }), { status: 201 });
}
