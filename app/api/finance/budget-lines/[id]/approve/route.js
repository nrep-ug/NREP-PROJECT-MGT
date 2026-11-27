import { handleFinanceRequest, readJson } from '@/lib/financeRoute';
import { reviewBudgetProposal } from '@/lib/financeService';

export async function POST(request, { params }) {
  return handleFinanceRequest(request, async (context) => {
    const { id } = await params;
    const { action, comment, comments } = await readJson(request);
    return { budgetLine: await reviewBudgetProposal(context, id, action, comment || comments) };
  });
}
