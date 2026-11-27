import { handleFinanceRequest, readJson } from '@/lib/financeRoute';
import { createAdjustment, listAdjustments } from '@/lib/financeService';

export async function GET(request) {
  return handleFinanceRequest(request, (context) => {
    const { searchParams } = new URL(request.url);
    return listAdjustments(context, {
      projectId: searchParams.get('projectId'),
      originalExpenseId: searchParams.get('originalExpenseId'),
      status: searchParams.get('status'),
    }).then((adjustments) => ({ adjustments, total: adjustments.length }));
  });
}

export async function POST(request) {
  return handleFinanceRequest(request, async (context) => ({
    adjustment: await createAdjustment(context, await readJson(request)),
  }), { status: 201 });
}
