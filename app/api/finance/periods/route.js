import { handleFinanceRequest, readJson } from '@/lib/financeRoute';
import { createFinancialPeriod, listFinancialPeriods } from '@/lib/financeService';

export async function GET(request) {
  return handleFinanceRequest(request, (context) => {
    const { searchParams } = new URL(request.url);
    return listFinancialPeriods(context, {
      projectId: searchParams.get('projectId'),
      status: searchParams.get('status'),
    }).then((periods) => ({ periods, total: periods.length }));
  });
}

export async function POST(request) {
  return handleFinanceRequest(request, async (context) => ({
    period: await createFinancialPeriod(context, await readJson(request)),
  }), { status: 201 });
}
