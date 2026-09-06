import { handleFinanceRequest } from '@/lib/financeRoute';
import { getActivityFinanceDetail } from '@/lib/financeService';

export async function GET(request, { params }) {
  return handleFinanceRequest(request, async (context) => {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    return getActivityFinanceDetail(context, id, {
      year: searchParams.get('year'),
      quarter: searchParams.get('quarter'),
    });
  });
}
