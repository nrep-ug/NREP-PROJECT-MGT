import { handleFinanceRequest, readJson } from '@/lib/financeRoute';
import { updateActivityFinancialStructure } from '@/lib/financeService';

export async function PATCH(request, { params }) {
  return handleFinanceRequest(request, async (context) => {
    const { id } = await params;
    return { activity: await updateActivityFinancialStructure(context, id, await readJson(request)) };
  });
}
