import { handleFinanceRequest, readJson } from '@/lib/financeRoute';
import { reviewFinanceRecord } from '@/lib/financeService';

export async function POST(request, { params }) {
  return handleFinanceRequest(request, async (context) => {
    const { id } = await params;
    const { action, comment, comments } = await readJson(request);
    return { expenditure: await reviewFinanceRecord(context, 'expenditure', id, action, comment || comments) };
  });
}

