import { handleFinanceRequest, readJson } from '@/lib/financeRoute';
import { getExpenditure, updateExpenditure } from '@/lib/financeService';

export async function GET(request, { params }) {
  return handleFinanceRequest(request, async (context) => {
    const { id } = await params;
    return { expenditure: await getExpenditure(context, id) };
  });
}

export async function PATCH(request, { params }) {
  return handleFinanceRequest(request, async (context) => {
    const { id } = await params;
    return { expenditure: await updateExpenditure(context, id, await readJson(request)) };
  });
}
