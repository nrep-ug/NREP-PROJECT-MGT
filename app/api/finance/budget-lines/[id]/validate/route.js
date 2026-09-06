import { handleFinanceRequest, readJson } from '@/lib/financeRoute';
import { validateBudgetProposal } from '@/lib/financeService';

export async function POST(request, { params }) {
  return handleFinanceRequest(request, async (context) => {
    const { id } = await params;
    const { action, comment, comments } = await readJson(request);
    return {
      budgetLine: await validateBudgetProposal(context, id, action, comment || comments),
    };
  });
}
