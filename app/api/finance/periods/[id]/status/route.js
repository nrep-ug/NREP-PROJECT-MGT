import { handleFinanceRequest, readJson } from '@/lib/financeRoute';
import { setFinancialPeriodStatus } from '@/lib/financeService';

export async function POST(request, { params }) {
  return handleFinanceRequest(request, async (context) => {
    const { id } = await params;
    return { period: await setFinancialPeriodStatus(context, id, await readJson(request)) };
  });
}
