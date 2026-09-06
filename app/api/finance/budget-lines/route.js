import { handleFinanceRequest, readJson } from '@/lib/financeRoute';
import { createBudgetLine, listBudgetLines } from '@/lib/financeService';

export async function GET(request) {
  return handleFinanceRequest(request, (context) => {
    const { searchParams } = new URL(request.url);
    return listBudgetLines(context, {
      projectId: searchParams.get('projectId'),
      status: searchParams.get('status'),
    }).then((budgetLines) => ({ budgetLines, total: budgetLines.length }));
  });
}

export async function POST(request) {
  return handleFinanceRequest(request, async (context) => ({
    budgetLine: await createBudgetLine(context, await readJson(request)),
  }), { status: 201 });
}

