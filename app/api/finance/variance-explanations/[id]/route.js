import { handleFinanceRequest, readJson } from '@/lib/financeRoute';
import { updateVarianceExplanation } from '@/lib/financeService';

export async function PATCH(request, { params }) {
  return handleFinanceRequest(request, async (context) => {
    const { id } = await params;
    return { explanation: await updateVarianceExplanation(context, id, await readJson(request)) };
  });
}
