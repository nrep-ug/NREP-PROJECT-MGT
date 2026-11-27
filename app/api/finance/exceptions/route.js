import { handleFinanceRequest } from '@/lib/financeRoute';
import { getFinanceExceptions } from '@/lib/financeService';

export async function GET(request) {
  return handleFinanceRequest(request, async (context) => {
    const { searchParams } = new URL(request.url);
    const items = await getFinanceExceptions(context, {
      projectId: searchParams.get('projectId'),
      type: searchParams.get('type'),
      severity: searchParams.get('severity'),
    });
    return { items, total: items.length };
  });
}
