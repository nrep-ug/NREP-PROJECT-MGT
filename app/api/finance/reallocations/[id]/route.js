import { handleFinanceRequest, readJson } from '@/lib/financeRoute';
import { updateReallocation } from '@/lib/financeService';

export async function PATCH(request, { params }) {
  return handleFinanceRequest(request, async (context) => {
    const { id } = await params;
    return { reallocation: await updateReallocation(context, id, await readJson(request)) };
  });
}
