import { handleFinanceRequest } from '@/lib/financeRoute';
import { getQuarterlyReport } from '@/lib/financeService';

export async function GET(request) {
  return handleFinanceRequest(request, (context) => {
    const { searchParams } = new URL(request.url);
    return getQuarterlyReport(context, {
      projectId: searchParams.get('projectId'),
      year: searchParams.get('year'),
      quarter: searchParams.get('quarter'),
    });
  });
}
