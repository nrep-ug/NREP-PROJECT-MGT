import { handleFinanceRequest, readJson } from '@/lib/financeRoute';
import { updateBudgetLine } from '@/lib/financeService';

export async function PATCH(request, { params }) {
  return handleFinanceRequest(request, async (context) => {
    const { id } = await params;
    return { budgetLine: await updateBudgetLine(context, id, await readJson(request)) };
  });
}
