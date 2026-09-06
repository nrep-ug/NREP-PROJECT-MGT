import { handleFinanceRequest, readJson } from '@/lib/financeRoute';
import { createExpenditure, listExpenditures } from '@/lib/financeService';

export async function GET(request) {
  return handleFinanceRequest(request, (context) => {
    const { searchParams } = new URL(request.url);
    return listExpenditures(context, {
      projectId: searchParams.get('projectId'),
      budgetLineId: searchParams.get('budgetLineId'),
      activityId: searchParams.get('activityId'),
      status: searchParams.get('status'),
      category: searchParams.get('category'),
      responsibleStaffId: searchParams.get('responsibleStaffId'),
      from: searchParams.get('from'),
      to: searchParams.get('to'),
    }).then((expenditures) => ({ expenditures, total: expenditures.length }));
  });
}

export async function POST(request) {
  return handleFinanceRequest(request, async (context) => ({
    expenditure: await createExpenditure(context, await readJson(request)),
  }), { status: 201 });
}

