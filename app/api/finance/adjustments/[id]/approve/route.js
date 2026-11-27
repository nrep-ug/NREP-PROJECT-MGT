import { handleFinanceRequest, readJson } from '@/lib/financeRoute';
import { reviewFinanceRecord } from '@/lib/financeService';

export async function POST(request, { params }) {
  return handleFinanceRequest(request, async (context) => {
    const { id } = await params;
    const { action, comment, comments } = await readJson(request);
    return { adjustment: await reviewFinanceRecord(context, 'adjustment', id, action, comment || comments) };
  });
}
