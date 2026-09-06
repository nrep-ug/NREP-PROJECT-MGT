import { handleFinanceRequest } from '@/lib/financeRoute';
import { getReviewQueue } from '@/lib/financeService';

export async function GET(request) {
  return handleFinanceRequest(request, getReviewQueue);
}
